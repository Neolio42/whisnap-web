import { BaseTranscriptionProvider, TranscriptionOptions } from './base';
import { TranscriptionResult } from '../../../../shared/types';
import FormData from 'form-data';
import fetch from 'node-fetch';

export class WhisperProvider extends BaseTranscriptionProvider {
  getApiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not configured');
    return key;
  }

  getCostPerHour(): number {
    return 0.36; // $0.36/hour for OpenAI Whisper API
  }

  getModelName(): string {
    return 'whisper-1';
  }

  supportsStreaming(): boolean {
    return false; // OpenAI Whisper API is batch only
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    const { audio, language = 'en' } = options;
    
    this.validateAudio(audio);

    // Create form data for OpenAI API
    const formData = new FormData();
    formData.append('file', audio, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Whisper transcription failed: ${errorText}`);
    }

    const result = await response.json() as any;
    
    return {
      text: result.text || '',
      provider: 'whisper-api',
      duration: this.estimateAudioDuration(audio),
      cost: '0', // Will be calculated by cost tracker
      metadata: {
        language: result.language,
        duration: result.duration,
        words: result.words?.map((w: any) => ({
          text: w.word,
          start: w.start,
          end: w.end
        }))
      }
    };
  }
}