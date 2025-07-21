import { LLMMessage, LLMResult } from '../../../../shared/types';

export interface LLMCompletionOptions {
  model: string;
  messages: LLMMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  userId: string;
  onStreamChunk?: (chunk: string) => void;
  onStreamComplete?: (result: LLMResult) => void;
}

export abstract class BaseLLMProvider {
  protected apiKey: string;
  
  constructor() {
    this.apiKey = this.getApiKey();
  }

  abstract getApiKey(): string;
  abstract complete(options: LLMCompletionOptions): Promise<LLMResult>;
  abstract calculateCost(model: string, inputTokens: number, outputTokens: number): number;
  abstract supportsStreaming(): boolean;
  abstract getAvailableModels(): string[];
  
  // Optional: streaming completion
  async streamComplete?(options: LLMCompletionOptions): Promise<void>;
  
  // Helper to validate messages
  protected validateMessages(messages: LLMMessage[]): void {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required and cannot be empty');
    }
    
    for (const message of messages) {
      if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
        throw new Error('Invalid message role. Must be system, user, or assistant');
      }
      
      if (!message.content || typeof message.content !== 'string') {
        throw new Error('Message content is required and must be a string');
      }
      
      if (message.content.length > 100000) { // 100k chars limit
        throw new Error('Message content too long (max 100,000 characters)');
      }
    }
  }
  
  // Helper to estimate token count (rough approximation)
  protected estimateTokenCount(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }
  
  // Helper to calculate total input tokens
  protected calculateInputTokens(messages: LLMMessage[]): number {
    const totalText = messages.map(m => m.content).join(' ');
    return this.estimateTokenCount(totalText);
  }
}