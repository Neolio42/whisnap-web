import { BaseTranscriptionProvider, TranscriptionOptions } from './base';
import { TranscriptionResult } from '@shared/types';
import WebSocket from 'ws';
import { fetch } from 'undici';

interface StreamingSession {
  ws: WebSocket;
  sessionId: string;
  userId: string;
  onTranscript?: (transcript: any) => void;
  onPartialTranscript?: (partial: any) => void;
  onError?: (error: Error) => void;
}

const activeSessions = new Map<string, StreamingSession>();

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

  // New streaming methods for WebSocket handler using Universal Streaming API v3
  async startStreaming(options: any): Promise<void> {
    const { sessionId, userId, language = 'en', sampleRate = 16000, onTranscript, onPartialTranscript, onError, onReady } = options;
    
    console.log(`🎤 Starting AssemblyAI Universal Streaming session: ${sessionId}`);
    
    // Use new Universal Streaming API v3 endpoint
    const connectionParams = new URLSearchParams({
      sample_rate: sampleRate.toString(),
      encoding: 'pcm_s16le',
      format_turns: 'true'
    });
    
    const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${connectionParams}`, {
      headers: {
        'Authorization': this.getApiKey()
      }
    });

    const session: StreamingSession = {
      ws,
      sessionId,
      userId,
      onTranscript,
      onPartialTranscript,
      onError
    };

    activeSessions.set(sessionId, session);

    ws.on('open', () => {
      console.log(`✅ AssemblyAI Universal Streaming connected for session: ${sessionId}`);
      // Notify that we're ready to receive audio
      onReady?.();
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.error) {
          console.error('❌ AssemblyAI error:', message.error);
          onError?.(new Error(`AssemblyAI error: ${message.error}`));
          return;
        }
        
        if (message.type === 'Turn') {
          const transcript = message.transcript || '';
          const isFormatted = message.turn_is_formatted;
          const isEndOfTurn = message.end_of_turn;
          
          if (transcript && transcript.trim() && isEndOfTurn && isFormatted) {
            onTranscript?.({ text: transcript, confidence: message.end_of_turn_confidence || 0 });
          }
        }
      } catch (error) {
        console.error('❌ Error parsing AssemblyAI message:', error);
        onError?.(new Error('Failed to parse response'));
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ AssemblyAI WebSocket error for session ${sessionId}:`, error);
      onError?.(error);
      activeSessions.delete(sessionId);
    });

    ws.on('close', () => {
      console.log(`🔌 AssemblyAI WebSocket closed for session: ${sessionId}`);
      activeSessions.delete(sessionId);
    });
  }

  async sendAudioData(sessionId: string, audioData: string): Promise<void> {
    const session = activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket not ready for session ${sessionId}`);
    }

    const audioBuffer = Buffer.from(audioData, 'base64');
    session.ws.send(audioBuffer);
  }

  async stopStreaming(sessionId: string): Promise<void> {
    const session = activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session ${sessionId} not found for stopping`);
      return;
    }

    console.log(`🛑 Stopping AssemblyAI Universal Streaming session: ${sessionId}`);
    
    if (session.ws.readyState === WebSocket.OPEN) {
      // Send termination message for v3 API
      session.ws.send(JSON.stringify({ type: 'Terminate' }));
      session.ws.close();
    }
    
    activeSessions.delete(sessionId);
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