import { BaseLLMProvider, LLMCompletionOptions } from './base';
import { LLMResult } from '../shared/types/index';
import { fetch } from 'undici';

export class OpenAIProvider extends BaseLLMProvider {
  getApiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not configured');
    return key;
  }

  supportsStreaming(): boolean {
    return true;
  }

  getAvailableModels(): string[] {
    return ['gpt-4o', 'gpt-4o-mini'];
  }

  async complete(options: LLMCompletionOptions): Promise<LLMResult> {
    const { model, messages, max_tokens = 1000, temperature = 0.7, stream = false } = options;
    
    this.validateMessages(messages);


    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.mapModelName(model),
        messages,
        max_tokens,
        temperature,
        stream,
        user: options.userId // For OpenAI usage tracking
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json() as any;
    
    return {
      choices: result.choices || [],
      usage: result.usage,
      model: result.model || model,
      duration: 0, // Will be set by caller
      cost: '0' // Will be calculated by cost tracker
    };
  }

  // Streaming implementation
  async streamComplete(options: LLMCompletionOptions): Promise<void> {
    const { model, messages, max_tokens = 1000, temperature = 0.7, onStreamChunk, onStreamComplete } = options;
    
    if (!onStreamChunk) {
      throw new Error('onStreamChunk callback required for streaming');
    }

    this.validateMessages(messages);


    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.mapModelName(model),
        messages,
        max_tokens,
        temperature,
        stream: true,
        user: options.userId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI streaming error: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    let fullContent = '';
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    // Process streaming response
    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              // Stream complete
              if (onStreamComplete) {
                onStreamComplete({
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: fullContent
                    },
                    finish_reason: 'stop'
                  }],
                  usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: totalTokens
                  },
                  model,
                  duration: 0,
                  cost: '0'
                });
              }
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              
              if (delta?.content) {
                fullContent += delta.content;
                onStreamChunk(delta.content);
              }
              
              if (parsed.usage) {
                promptTokens = parsed.usage.prompt_tokens || 0;
                completionTokens = parsed.usage.completion_tokens || 0;
                totalTokens = parsed.usage.total_tokens || 0;
              }
            } catch (parseError) {
              // Skip invalid JSON chunks
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // OpenAI pricing (per 1M tokens) - Updated rates
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.50 / 1000000, output: 10.00 / 1000000 },
      'gpt-4o-mini': { input: 0.15 / 1000000, output: 0.60 / 1000000 }
    };

    const rates = pricing[model] || pricing['gpt-4o-mini'];
    return (inputTokens * rates!.input) + (outputTokens * rates!.output);
  }

  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'gpt-4o': 'gpt-4o',
      'gpt-4o-mini': 'gpt-4o-mini'
    };
    
    return modelMap[model] || 'gpt-4o-mini';
  }
}