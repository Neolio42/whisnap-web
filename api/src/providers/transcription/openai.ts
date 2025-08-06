import { BaseTranscriptionProvider, TranscriptionOptions } from './base';
import { TranscriptionResult } from '../shared/types/index';
import FormData from 'form-data';
import { fetch } from 'undici';

export class OpenAITranscriptionProvider extends BaseTranscriptionProvider {
  getApiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not configured');
    return key;
  }

  getCostPerHour(): number {
    return 21.6; // $0.006 per minute = $21.6 per hour
  }

  getModelName(): string {
    return 'whisper-1';
  }

  supportsStreaming(): boolean {
    return false;
  }

  getSupportedFormats(): string[] {
    return ['mp3', 'mp4', 'wav', 'webm', 'ogg', 'flac', 'm4a'];
  }

  getMaxFileSize(): number {
    return 25 * 1024 * 1024; // 25MB
  }

  getFeatures(): string[] {
    return ['transcription', 'translation', 'timestamps'];
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    const { audio, language, userId } = options;
    
    if (!audio || audio.length === 0) {
      throw new Error('Audio buffer is required');
    }

    if (audio.length > this.getMaxFileSize()) {
      throw new Error('File size exceeds maximum limit');
    }

    this.validateAudio(audio);


    const formData = new FormData();
    formData.append('file', audio, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('model', 'whisper-1');
    
    if (language) {
      formData.append('language', language);
    }

    formData.append('response_format', 'verbose_json');

    const endpoint = 'https://api.openai.com/v1/audio/transcriptions';

    // Convert form-data to buffer for native fetch
    const body = formData.getBuffer();
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      ...formData.getHeaders()
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Whisper API error: ${errorText}`);
    }

    const result = await response.json() as any;
    
    return {
      text: result.text || '',
      provider: 'whisper-api',
      duration: this.estimateAudioDuration(audio),
      cost: '0',
      metadata: {
        language: result.language,
        duration: result.duration,
        words: result.words
      }
    };
  }

  calculateCost(provider: string, fileSize: number, duration: number): number {
    // OpenAI Whisper: $0.006 per minute
    return duration * 0.006;
  }

  private mapFormat(format: string): string {
    const formatMap: Record<string, string> = {
      'text': 'text',
      'json': 'verbose_json',
      'srt': 'srt',
      'vtt': 'vtt'
    };
    return formatMap[format] || 'text';
  }

  private getFileExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext || 'mp3';
  }

  private validateAudioFormat(mimeType: string): void {
    const supportedTypes = [
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav',
      'audio/webm', 'audio/ogg', 'audio/flac', 'audio/m4a'
    ];
    
    if (!supportedTypes.includes(mimeType)) {
      throw new Error(`Unsupported audio format: ${mimeType}`);
    }
  }
}