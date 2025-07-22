import { BaseTranscriptionProvider, TranscriptionOptions } from './base';
import { TranscriptionResult } from '../../../../shared/types';
import FormData from 'form-data';
import { fetch } from 'undici';

export class RevAIProvider extends BaseTranscriptionProvider {
  getApiKey(): string {
    const key = process.env.REV_AI_API_KEY;
    if (!key) throw new Error('REV_AI_API_KEY not configured');
    return key;
  }

  getCostPerHour(): number {
    return 0.18; // $0.18/hour for Rev AI Turbo
  }

  getModelName(): string {
    return 'rev-turbo';
  }

  supportsStreaming(): boolean {
    return false; // Rev AI Turbo is batch only
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    const { audio, language = 'en' } = options;
    
    this.validateAudio(audio);

    // Create form data for Rev AI API
    const formData = new FormData();
    formData.append('media', audio, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('options', JSON.stringify({
      language,
      transcriber: 'machine_v2', // Turbo model
      verbatim: false,
      rush: true
    }));

    // Submit job
    const submitResponse = await fetch('https://api.rev.ai/speechtotext/v1/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!submitResponse.ok) {
      throw new Error(`Rev AI submission failed: ${submitResponse.statusText}`);
    }

    const job = await submitResponse.json() as any;
    const jobId = job.id;

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.rev.ai/speechtotext/v1/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });

      const status = await statusResponse.json() as any;
      
      if (status.status === 'transcribed') {
        // Get transcript
        const transcriptResponse = await fetch(`https://api.rev.ai/speechtotext/v1/jobs/${jobId}/transcript`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/vnd.rev.transcript.v1.0+json'
          }
        });

        const transcript = await transcriptResponse.json() as any;
        
        return {
          text: this.extractText(transcript),
          provider: 'rev-turbo',
          duration: this.estimateAudioDuration(audio),
          cost: '0', // Will be calculated by cost tracker
          metadata: {
            confidence: this.calculateConfidence(transcript),
            language,
            duration: status.duration_seconds
          }
        };
      } else if (status.status === 'failed') {
        throw new Error(`Rev AI transcription failed: ${status.failure_detail}`);
      }
      
      attempts++;
    }

    throw new Error('Rev AI transcription timed out');
  }

  private extractText(transcript: any): string {
    return transcript.monologues
      ?.map((m: any) => m.elements?.filter((e: any) => e.type === 'text').map((e: any) => e.value).join(' '))
      .join(' ') || '';
  }

  private calculateConfidence(transcript: any): number {
    const elements = transcript.monologues?.flatMap((m: any) => m.elements?.filter((e: any) => e.type === 'text')) || [];
    if (elements.length === 0) return 0;
    
    const avgConfidence = elements.reduce((sum: number, e: any) => sum + (e.confidence || 0), 0) / elements.length;
    return Math.round(avgConfidence * 100) / 100;
  }
}