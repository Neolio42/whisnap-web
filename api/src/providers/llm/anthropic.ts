import { BaseLLMProvider, LLMCompletionOptions } from './base';
import { LLMResult } from '../../../../shared/types';
import fetch from 'node-fetch';

export class AnthropicProvider extends BaseLLMProvider {
  getApiKey(): string {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
    return key;
  }

  supportsStreaming(): boolean {
    return true;
  }

  getAvailableModels(): string[] {
    return ['claude-3-5-sonnet', 'claude-3-5-haiku'];
  }

  async complete(options: LLMCompletionOptions): Promise<LLMResult> {
    const { model, messages, max_tokens = 1000, temperature = 0.7, stream = false } = options;
    
    this.validateMessages(messages);

    // Convert OpenAI format to Anthropic format
    const { system, conversationMessages } = this.convertMessages(messages);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.mapModelName(model),
        max_tokens,
        temperature,
        system,
        messages: conversationMessages,
        stream
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${errorText}`);
    }

    const result = await response.json() as any;
    
    // Convert Anthropic format to OpenAI format for consistency
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: result.content?.[0]?.text || ''
        },
        finish_reason: this.mapFinishReason(result.stop_reason)
      }],
      usage: {
        prompt_tokens: result.usage?.input_tokens || 0,
        completion_tokens: result.usage?.output_tokens || 0,
        total_tokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0)
      },
      model: result.model || model,
      duration: 0,
      cost: '0'
    };
  }

  // Streaming implementation
  async streamComplete(options: LLMCompletionOptions): Promise<void> {
    const { model, messages, max_tokens = 1000, temperature = 0.7, onStreamChunk, onStreamComplete } = options;
    
    if (!onStreamChunk) {
      throw new Error('onStreamChunk callback required for streaming');
    }

    this.validateMessages(messages);

    const { system, conversationMessages } = this.convertMessages(messages);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.mapModelName(model),
        max_tokens,
        temperature,
        system,
        messages: conversationMessages,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic streaming error: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    // Process streaming response
    const reader = response.body.getReader();
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
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                const text = parsed.delta?.text;
                if (text) {
                  fullContent += text;
                  onStreamChunk(text);
                }
              } else if (parsed.type === 'message_start') {
                inputTokens = parsed.message?.usage?.input_tokens || 0;
              } else if (parsed.type === 'message_delta') {
                outputTokens = parsed.delta?.usage?.output_tokens || 0;
              } else if (parsed.type === 'message_stop') {
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
                      prompt_tokens: inputTokens,
                      completion_tokens: outputTokens,
                      total_tokens: inputTokens + outputTokens
                    },
                    model,
                    duration: 0,
                    cost: '0'
                  });
                }
                return;
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
    // Anthropic pricing (per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-5-sonnet': { input: 3.00 / 1000000, output: 15.00 / 1000000 },
      'claude-3-5-haiku': { input: 0.25 / 1000000, output: 1.25 / 1000000 }
    };

    const rates = pricing[model] || pricing['claude-3-5-haiku'];
    return (inputTokens * rates.input) + (outputTokens * rates.output);
  }

  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku': 'claude-3-5-haiku-20241022'
    };
    
    return modelMap[model] || 'claude-3-5-haiku-20241022';
  }

  private convertMessages(messages: any[]): { system: string; conversationMessages: any[] } {
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    return {
      system: systemMessage,
      conversationMessages
    };
  }

  private mapFinishReason(stopReason: string): string {
    const reasonMap: Record<string, string> = {
      'end_turn': 'stop',
      'max_tokens': 'length',
      'stop_sequence': 'stop'
    };
    
    return reasonMap[stopReason] || 'stop';
  }
}