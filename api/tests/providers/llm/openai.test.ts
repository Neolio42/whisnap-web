import { OpenAIProvider } from '../../../src/providers/llm/openai';
import { mockFetchResponse, mockStreamingFetchResponse } from '../../setup';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
  });

  describe('getApiKey', () => {
    it('should return the API key from environment', () => {
      const apiKey = provider.getApiKey();
      expect(apiKey).toBe('test-openai-key');
    });

    it('should throw error if API key is not configured', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new OpenAIProvider()).toThrow('OPENAI_API_KEY not configured');
      process.env.OPENAI_API_KEY = 'test-openai-key'; // Restore
    });
  });

  describe('supportsStreaming', () => {
    it('should return true', () => {
      expect(provider.supportsStreaming()).toBe(true);
    });
  });

  describe('getAvailableModels', () => {
    it('should return correct models', () => {
      const models = provider.getAvailableModels();
      expect(models).toEqual(['gpt-4o', 'gpt-4o-mini']);
    });
  });

  describe('complete', () => {
    const mockMessages = [
      { role: 'user', content: 'Hello, world!' }
    ];

    it('should complete successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: { role: 'assistant', content: 'Hello! How can I help you?' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        model: 'gpt-4o'
      };

      mockFetchResponse(mockResponse);

      const result = await provider.complete({
        model: 'gpt-4o',
        messages: mockMessages,
        userId: 'user-123'
      });

      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.content).toBe('Hello! How can I help you?');
      expect(result.usage.total_tokens).toBe(18);
    });

    it('should handle API errors', async () => {
      mockFetchResponse({ error: 'Invalid request' }, 400);

      await expect(provider.complete({
        model: 'gpt-4o',
        messages: mockMessages,
        userId: 'user-123'
      })).rejects.toThrow('OpenAI API error');
    });

    it('should validate messages', async () => {
      await expect(provider.complete({
        model: 'gpt-4o',
        messages: [],
        userId: 'user-123'
      })).rejects.toThrow('Messages array is required and cannot be empty');
    });

    it('should validate message format', async () => {
      const invalidMessages = [
        { role: 'invalid', content: 'test' }
      ];

      await expect(provider.complete({
        model: 'gpt-4o',
        messages: invalidMessages as any,
        userId: 'user-123'
      })).rejects.toThrow('Invalid message role');
    });
  });

  describe('streamComplete', () => {
    const mockMessages = [
      { role: 'user', content: 'Tell me a story' }
    ];

    it('should stream completion successfully', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Once"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" upon"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" a time"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      mockStreamingFetchResponse(chunks);

      const receivedChunks: string[] = [];
      let completionResult: any = null;

      await provider.streamComplete({
        model: 'gpt-4o',
        messages: mockMessages,
        userId: 'user-123',
        onStreamChunk: (chunk) => {
          receivedChunks.push(chunk);
        },
        onStreamComplete: (result) => {
          completionResult = result;
        }
      });

      expect(receivedChunks).toEqual(['Once', ' upon', ' a time']);
      expect(completionResult).not.toBeNull();
      expect(completionResult.choices[0].message.content).toBe('Once upon a time');
    });

    it('should require onStreamChunk callback', async () => {
      await expect(provider.streamComplete({
        model: 'gpt-4o',
        messages: mockMessages,
        userId: 'user-123'
      })).rejects.toThrow('onStreamChunk callback required for streaming');
    });

    it('should handle streaming errors', async () => {
      mockFetchResponse({ error: 'Rate limit exceeded' }, 429);

      await expect(provider.streamComplete({
        model: 'gpt-4o',
        messages: mockMessages,
        userId: 'user-123',
        onStreamChunk: jest.fn()
      })).rejects.toThrow('OpenAI streaming error');
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for gpt-4o correctly', () => {
      const cost = provider.calculateCost('gpt-4o', 1000, 500);
      // gpt-4o: $2.50 input, $10.00 output per 1M tokens
      // Input: 1000 * (2.50/1000000) = 0.0025
      // Output: 500 * (10.00/1000000) = 0.005
      // Total: 0.0075
      expect(cost).toBeCloseTo(0.0075, 6);
    });

    it('should calculate cost for gpt-4o-mini correctly', () => {
      const cost = provider.calculateCost('gpt-4o-mini', 1000, 500);
      // gpt-4o-mini: $0.15 input, $0.60 output per 1M tokens
      // Input: 1000 * (0.15/1000000) = 0.00015
      // Output: 500 * (0.60/1000000) = 0.0003
      // Total: 0.00045
      expect(cost).toBeCloseTo(0.00045, 6);
    });

    it('should fallback to gpt-4o-mini pricing for unknown models', () => {
      const cost = provider.calculateCost('unknown-model', 1000, 500);
      expect(cost).toBeCloseTo(0.00045, 6);
    });
  });

  describe('mapModelName', () => {
    it('should map known models correctly', () => {
      // Using reflection to test private method
      const mapModelName = (provider as any).mapModelName.bind(provider);
      
      expect(mapModelName('gpt-4o')).toBe('gpt-4o');
      expect(mapModelName('gpt-4o-mini')).toBe('gpt-4o-mini');
    });

    it('should fallback to gpt-4o-mini for unknown models', () => {
      const mapModelName = (provider as any).mapModelName.bind(provider);
      expect(mapModelName('unknown-model')).toBe('gpt-4o-mini');
    });
  });
});