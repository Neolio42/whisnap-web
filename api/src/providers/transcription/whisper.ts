import { BaseTranscriptionProvider, TranscriptionOptions } from './base';
import { TranscriptionResult } from '../../../../shared/types';
import { fetch } from 'undici';
import FormData from 'form-data';

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

    // Create multipart form data manually for better compatibility
    const boundary = `----formdata-whisnap-${Date.now()}`;
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    let body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n`),
      Buffer.from(`Content-Type: audio/wav\r\n\r\n`),
      audio,
      Buffer.from(`\r\n--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="model"\r\n\r\n`),
      Buffer.from(`whisper-1`),
      Buffer.from(`\r\n--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="language"\r\n\r\n`),
      Buffer.from(language),
      Buffer.from(`\r\n--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="response_format"\r\n\r\n`),
      Buffer.from(`json`),
      Buffer.from(closeDelimiter)
    ]);

    console.log('🎵 Whisper API Debug:', {
      audioSize: audio.length,
      language,
      model: 'whisper-1',
      bodySize: body.length
    });

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body: body
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