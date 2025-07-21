import { BaseTranscriptionProvider, TranscriptionOptions } from './base';
import { TranscriptionResult } from '../../../../shared/types';
import WebSocket from 'ws';
import { fetch } from 'undici';

export class AssemblyAIProvider extends BaseTranscriptionProvider {
  getApiKey(): string {
    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) throw new Error('ASSEMBLYAI_API_KEY not configured');
    return key;
  }

  getCostPerHour(): number {
    return 0.15; // $0.15/hour for AssemblyAI Streaming
  }

  getModelName(): string {
    return 'assemblyai-streaming';
  }

  supportsStreaming(): boolean {
    return true;
  }

  getSupportedFormats(): string[] {
    return ['mp3', 'mp4', 'wav', 'webm', 'ogg', 'flac', 'm4a'];
  }

  getMaxFileSize(): number {
    return 100 * 1024 * 1024; // 100MB
  }

  getFeatures(): string[] {
    return ['transcription', 'streaming', 'speaker-detection', 'punctuation'];
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    const { audio, language = 'en' } = options;
    
    this.validateAudio(audio);


    // Upload audio file first
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: audio
    });

    if (!uploadResponse.ok) {
      throw new Error(`AssemblyAI upload failed: ${uploadResponse.statusText}`);
    }

    const { upload_url } = await uploadResponse.json() as any;

    // Submit transcription job
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: this.mapLanguageCode(language),
        punctuate: true,
        format_text: true,
        word_boost: [], // Can be customized for domain-specific terms
        boost_param: 'default'
      })
    });

    if (!transcriptResponse.ok) {
      throw new Error(`AssemblyAI transcription failed: ${transcriptResponse.statusText}`);
    }

    const transcript = await transcriptResponse.json() as any;
    const transcriptId = transcript.id;

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': this.apiKey,
        }
      });

      const status = await statusResponse.json() as any;
      
      if (status.status === 'completed') {
        return {
          text: status.text || '',
          provider: 'assemblyai-streaming',
          duration: this.estimateAudioDuration(audio),
          cost: '0', // Will be calculated by cost tracker
          metadata: {
            confidence: status.confidence,
            language,
            duration: status.audio_duration,
            words: status.words?.map((w: any) => ({
              text: w.text,
              start: w.start / 1000, // Convert ms to seconds
              end: w.end / 1000,
              confidence: w.confidence
            }))
          }
        };
      } else if (status.status === 'error') {
        throw new Error(`AssemblyAI transcription failed: ${status.error}`);
      }
      
      attempts++;
    }

    throw new Error('AssemblyAI transcription timed out');
  }

  calculateCost(provider: string, fileSize: number, duration: number): number {
    // AssemblyAI: $0.15 per hour
    return duration * 0.15 / 3600; // Convert seconds to hours
  }

  // Streaming transcription using WebSocket
  async streamTranscribe(options: TranscriptionOptions): Promise<void> {
    const { onPartialResult, onFinalResult } = options;
    
    if (!onPartialResult) {
      throw new Error('onPartialResult callback required for streaming');
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://api.assemblyai.com/v2/realtime/ws', {
        headers: {
          'Authorization': this.apiKey
        }
      });

      ws.on('open', () => {
        // Send configuration
        ws.send(JSON.stringify({
          sample_rate: 16000,
          word_boost: [],
          encoding: 'pcm_s16le'
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.message_type === 'PartialTranscript') {
          onPartialResult(message.text, message.confidence);
        } else if (message.message_type === 'FinalTranscript') {
          const result: TranscriptionResult = {
            text: message.text,
            provider: 'assemblyai-streaming',
            duration: 0, // Real-time, no total duration
            cost: '0',
            metadata: {
              confidence: message.confidence,
              words: message.words?.map((w: any) => ({
                text: w.text,
                start: w.start / 1000,
                end: w.end / 1000,
                confidence: w.confidence
              }))
            }
          };
          
          if (onFinalResult) {
            onFinalResult(result);
          }
        }
      });

      ws.on('error', (error) => {
        reject(new Error(`AssemblyAI streaming error: ${error.message}`));
      });

      ws.on('close', () => {
        resolve();
      });

      // Store WebSocket reference for sending audio data
      (options as any).websocket = ws;
    });
  }

  private mapLanguageCode(language: string): string {
    const languageMap: Record<string, string> = {
      'en': 'en_us',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'it': 'it',
      'pt': 'pt',
      'nl': 'nl',
      'hi': 'hi',
      'ja': 'ja',
      'zh': 'zh',
      'ko': 'ko'
    };
    
    return languageMap[language] || 'en_us';
  }
}