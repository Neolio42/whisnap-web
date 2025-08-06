import { RevAIProvider } from './rev';
import { AssemblyAIProvider } from './assemblyai';
import { DeepgramProvider } from './deepgram';
import { WhisperProvider } from './whisper';
import { BaseTranscriptionProvider } from './base';
import { TranscriptionProvider } from '../../../../shared/types';

// Provider registry with lazy initialization
const providerInstances: Partial<Record<TranscriptionProvider, BaseTranscriptionProvider>> = {};

export const TRANSCRIPTION_PROVIDERS = {
  'rev-turbo': () => providerInstances['rev-turbo'] || (providerInstances['rev-turbo'] = new RevAIProvider()),
  'assemblyai-streaming': () => providerInstances['assemblyai-streaming'] || (providerInstances['assemblyai-streaming'] = new AssemblyAIProvider()),
  'deepgram-nova3': () => providerInstances['deepgram-nova3'] || (providerInstances['deepgram-nova3'] = new DeepgramProvider()),
  'whisper-api': () => providerInstances['whisper-api'] || (providerInstances['whisper-api'] = new WhisperProvider())
};

// Smart provider selection logic
export function selectTranscriptionProvider(params: {
  streaming?: boolean;
  fileSize?: number;
  duration?: number;
  quality?: 'fast' | 'balanced' | 'accurate';
  language?: string;
  budget?: 'low' | 'medium' | 'high';
}): TranscriptionProvider {
  const { streaming = false, quality = 'balanced', language = 'en', budget = 'medium' } = params;

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
  const providerFactory = TRANSCRIPTION_PROVIDERS[provider];
  if (!providerFactory) {
    throw new Error(`Unknown transcription provider: ${provider}`);
  }
  return providerFactory();
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
  return Object.entries(TRANSCRIPTION_PROVIDERS).map(([name, providerFactory]) => ({
    name: name as TranscriptionProvider,
    costPerHour: providerFactory().getCostPerHour(),
    supportsStreaming: providerFactory().supportsStreaming(),
    modelName: providerFactory().getModelName()
  }));
}