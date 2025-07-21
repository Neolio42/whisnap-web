import { RevAIProvider } from './rev';
import { AssemblyAIProvider } from './assemblyai';
import { DeepgramProvider } from './deepgram';
import { WhisperProvider } from './whisper';
import { BaseTranscriptionProvider } from './base';
import { TranscriptionProvider } from '../../../../shared/types';

// Provider registry
export const TRANSCRIPTION_PROVIDERS: Record<TranscriptionProvider, BaseTranscriptionProvider> = {
  'rev-turbo': new RevAIProvider(),
  'assemblyai-streaming': new AssemblyAIProvider(),
  'deepgram-nova3': new DeepgramProvider(),
  'whisper-api': new WhisperProvider()
};

// Smart provider selection logic
export function selectTranscriptionProvider(params: {
  streaming: boolean;
  duration?: number;
  quality?: 'fast' | 'balanced' | 'accurate';
  language?: string;
  cost_limit?: number;
}): TranscriptionProvider {
  const { streaming, quality = 'balanced', language = 'en' } = params;

  // If streaming is required, filter to streaming providers
  if (streaming) {
    return quality === 'fast' ? 'assemblyai-streaming' : 'deepgram-nova3';
  }

  // For batch processing
  switch (quality) {
    case 'fast':
      return 'rev-turbo'; // $0.18/hr, fastest batch
    case 'accurate':
      return 'whisper-api'; // $0.36/hr but highest accuracy
    default:
      return 'assemblyai-streaming'; // $0.15/hr good balance
  }
}

// Get provider instance
export function getTranscriptionProvider(provider: TranscriptionProvider): BaseTranscriptionProvider {
  const instance = TRANSCRIPTION_PROVIDERS[provider];
  if (!instance) {
    throw new Error(`Unknown transcription provider: ${provider}`);
  }
  return instance;
}

// Check if provider supports streaming
export function providerSupportsStreaming(provider: TranscriptionProvider): boolean {
  return getTranscriptionProvider(provider).supportsStreaming();
}

// Get all available providers
export function getAvailableProviders(): Array<{
  name: TranscriptionProvider;
  costPerHour: number;
  supportsStreaming: boolean;
  modelName: string;
}> {
  return Object.entries(TRANSCRIPTION_PROVIDERS).map(([name, provider]) => ({
    name: name as TranscriptionProvider,
    costPerHour: provider.getCostPerHour(),
    supportsStreaming: provider.supportsStreaming(),
    modelName: provider.getModelName()
  }));
}