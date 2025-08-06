import { TranscriptionResult } from '../shared/types/index';

export interface TranscriptionOptions {
  audio: Buffer;
  language?: string;
  userId: string;
  streaming?: boolean;
  onPartialResult?: (text: string, confidence: number) => void;
  onFinalResult?: (result: TranscriptionResult) => void;
}

export abstract class BaseTranscriptionProvider {
  protected apiKey: string;
  
  constructor() {
    this.apiKey = this.getApiKey();
  }

  abstract getApiKey(): string;
  abstract transcribe(options: TranscriptionOptions): Promise<TranscriptionResult>;
  abstract getCostPerHour(): number;
  abstract getModelName(): string;
  abstract supportsStreaming(): boolean;
  
  // Optional methods that providers can override
  getSupportedFormats?(): string[];
  getMaxFileSize?(): number;
  getFeatures?(): string[];
  
  // Optional: streaming transcription
  async streamTranscribe?(options: TranscriptionOptions): Promise<void>;
  
  // Optional: WebSocket streaming methods
  async startStreaming?(options: any): Promise<void>;
  async sendAudioData?(sessionId: string, audioData: string): Promise<void>;
  async stopStreaming?(sessionId: string): Promise<void>;
  
  // Helper to validate audio format
  protected validateAudio(audio: Buffer): void {
    if (!audio || audio.length === 0) {
      throw new Error('Audio buffer is empty');
    }
    
    if (audio.length > 25 * 1024 * 1024) { // 25MB limit
      throw new Error('Audio file too large (max 25MB)');
    }
  }
  
  // Helper to estimate audio duration from file size
  protected estimateAudioDuration(audio: Buffer): number {
    // Rough estimate: 16kHz, 16-bit mono = ~32KB per second
    return audio.length / 32000;
  }

  // Calculate cost based on provider rates
  calculateCost(provider: string, fileSizeMB: number, durationSeconds: number): number {
    const costPerHour = this.getCostPerHour();
    const durationHours = durationSeconds / 3600;
    return costPerHour * Math.max(durationHours, 0.01); // Minimum 1 cent
  }
}