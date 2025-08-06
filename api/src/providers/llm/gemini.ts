import { BaseLLMProvider, LLMCompletionOptions } from './base';
import { LLMResult } from '../shared/types';
import { fetch } from 'undici';

export class GeminiProvider extends BaseLLMProvider {
  getApiKey(): string {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error('GOOGLE_AI_API_KEY not configured');
    return key;
  }

  supportsStreaming(): boolean {
    return true;
  }

  getAvailableModels(): string[] {
    return ['gemini-1.5-pro', 'gemini-1.5-flash'];
  }

  async complete(options: LLMCompletionOptions): Promise<LLMResult> {
    const { model, messages, max_tokens = 1000, temperature = 0.7, stream = false } = options;
    
    this.validateMessages(messages);

    // Convert OpenAI format to Gemini format
    const geminiMessages = this.convertMessages(messages);
    
    const modelName = this.mapModelName(model);
    const endpoint = stream 
      ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${this.apiKey}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: max_tokens,
          temperature
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google AI API error: ${errorText}`);
    }

    const result = await response.json() as any;
    
    // Convert Gemini format to OpenAI format for consistency
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = this.mapFinishReason(result.candidates?.[0]?.finishReason);
    
    return {
      choices: [{
        message: {
          role: 'assistant',
          content
        },
        finish_reason: finishReason
      }],
      usage: {
        prompt_tokens: result.usageMetadata?.promptTokenCount || 0,
        completion_tokens: result.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: result.usageMetadata?.totalTokenCount || 0
      },
      model: result.modelVersion || model,
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

    const geminiMessages = this.convertMessages(messages);
    const modelName = this.mapModelName(model);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: max_tokens,
          temperature
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini streaming error: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        
        // Gemini streams JSON objects separated by newlines
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (content) {
              fullContent += content;
              onStreamChunk(content);
            }
            
            // Update token counts if available
            if (parsed.usageMetadata) {
              promptTokens = parsed.usageMetadata.promptTokenCount || 0;
              completionTokens = parsed.usageMetadata.candidatesTokenCount || 0;
            }
            
            // Check if stream is complete
            const finishReason = parsed.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
              // Stream complete
              if (onStreamComplete) {
                onStreamComplete({
                  choices: [{
                    message: {
                      role: 'assistant',
                      content: fullContent
                    },
                    finish_reason: this.mapFinishReason(finishReason)
                  }],
                  usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: promptTokens + completionTokens
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
      
      // If we get here, stream ended without explicit finish reason
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
            total_tokens: promptTokens + completionTokens
          },
          model,
          duration: 0,
          cost: '0'
        });
      }
    } finally {
      reader.releaseLock();
    }
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Google AI pricing (per 1M tokens) - approximate rates
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-1.5-pro': { input: 1.25 / 1000000, output: 5.00 / 1000000 },
      'gemini-1.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 }
    };

    const rates = pricing[model] ?? pricing['gemini-1.5-flash']!;
    return (inputTokens * rates.input) + (outputTokens * rates.output);
  }

  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash'
    };
    
    return modelMap[model] || 'gemini-1.5-flash';
  }

  private convertMessages(messages: any[]): any[] {
    const geminiMessages = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // System messages can be prepended as user messages in Gemini
        geminiMessages.push({
          role: 'user',
          parts: [{ text: `System: ${message.content}` }]
        });
      } else {
        geminiMessages.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        });
      }
    }
    
    return geminiMessages;
  }

  private mapFinishReason(finishReason: string): string {
    const reasonMap: Record<string, string> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter'
    };
    
    return reasonMap[finishReason] || 'stop';
  }
}