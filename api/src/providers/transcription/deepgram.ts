import { BaseTranscriptionProvider, TranscriptionOptions } from './base';
import { TranscriptionResult } from '@shared/types';
import { fetch } from 'undici';
import WebSocket from 'ws';

export class DeepgramProvider extends BaseTranscriptionProvider {
  getApiKey(): string {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error('DEEPGRAM_API_KEY not configured');
    return key;
  }

  getCostPerHour(): number {
    return 0.258; // $0.258/hour for Deepgram Nova-3
  }

  getModelName(): string {
    return 'deepgram-nova3';
  }

  supportsStreaming(): boolean {
    return true;
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    const { audio, language = 'en' } = options;
    
    this.validateAudio(audio);

    const params = new URLSearchParams({
      model: 'nova-2',
      language,
      punctuate: 'true',
      format: 'json',
      version: 'latest',
      smart_format: 'true',
      paragraphs: 'true',
      utterances: 'true',
      diarize: 'false' // Can be enabled for speaker separation
    });

    const response = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'audio/wav'
      },
      body: audio
    });

    if (!response.ok) {
      throw new Error(`Deepgram transcription failed: ${response.statusText}`);
    }

    const result = await response.json() as any;
    
    if (!result.results?.channels?.[0]?.alternatives?.[0]) {
      throw new Error('No transcription results from Deepgram');
    }

    const alternative = result.results.channels[0].alternatives[0];
    
    return {
      text: alternative.transcript || '',
      provider: 'deepgram-nova3',
      duration: this.estimateAudioDuration(audio),
      cost: '0', // Will be calculated by cost tracker
      metadata: {
        confidence: alternative.confidence,
        language,
        duration: result.metadata?.duration,
        words: alternative.words?.map((w: any) => ({
          text: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence
        }))
      }
    };
  }

  // Streaming transcription using WebSocket
  async streamTranscribe(options: TranscriptionOptions): Promise<void> {
    const { language = 'en', onPartialResult, onFinalResult } = options;
    
    if (!onPartialResult) {
      throw new Error('onPartialResult callback required for streaming');
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${language}&punctuate=true&smart_format=true&interim_results=true`;
      
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      ws.on('open', () => {
        console.log('Deepgram WebSocket connected');
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'Results') {
          const transcript = message.channel?.alternatives?.[0]?.transcript;
          const confidence = message.channel?.alternatives?.[0]?.confidence || 0;
          const isFinal = message.is_final;
          
          if (transcript) {
            if (isFinal) {
              const result: TranscriptionResult = {
                text: transcript,
                provider: 'deepgram-nova3',
                duration: 0, // Real-time, no total duration
                cost: '0',
                metadata: {
                  confidence,
                  language,
                  words: message.channel?.alternatives?.[0]?.words?.map((w: any) => ({
                    text: w.word,
                    start: w.start,
                    end: w.end,
                    confidence: w.confidence
                  }))
                }
              };
              
              if (onFinalResult) {
                onFinalResult(result);
              }
            } else {
              onPartialResult(transcript, confidence);
            }
          }
        } else if (message.type === 'SpeechStarted') {
          console.log('Speech detected');
        } else if (message.type === 'UtteranceEnd') {
          console.log('Utterance ended');
        }
      });

      ws.on('error', (error) => {
        reject(new Error(`Deepgram streaming error: ${error.message}`));
      });

      ws.on('close', (code, reason) => {
        console.log(`Deepgram WebSocket closed: ${code} ${reason}`);
        resolve();
      });

      // Store WebSocket reference for sending audio data
      (options as any).websocket = ws;
    });
  }
}