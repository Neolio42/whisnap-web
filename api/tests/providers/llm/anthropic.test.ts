import { AnthropicProvider } from '../../../src/providers/llm/anthropic';
import { mockFetchResponse, mockStreamingFetchResponse } from '../../setup';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  describe('getApiKey', () => {
    it('should return the API key from environment', () => {
      const apiKey = provider.getApiKey();
      expect(apiKey).toBe('test-anthropic-key');
    });

    it('should throw error if API key is not configured', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new AnthropicProvider()).toThrow('ANTHROPIC_API_KEY not configured');
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'; // Restore
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
      expect(models).toEqual(['claude-3-5-sonnet', 'claude-3-5-haiku']);
    });
  });

  describe('complete', () => {
    const mockMessages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, Claude!' }
    ];

    it('should complete successfully', async () => {
      const mockResponse = {
        content: [{ text: 'Hello! How can I help you today?' }],
        usage: { input_tokens: 15, output_tokens: 9 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockFetchResponse(mockResponse);

      const result = await provider.complete({
        model: 'claude-3-5-sonnet',
        messages: mockMessages,
        userId: 'user-123'
      });

      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.content).toBe('Hello! How can I help you today?');
      expect(result.usage.prompt_tokens).toBe(15);
      expect(result.usage.completion_tokens).toBe(9);
      expect(result.choices[0].finish_reason).toBe('stop');
    });

    it('should convert messages correctly', async () => {
      const mockResponse = {
        content: [{ text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn'
      };

      mockFetchResponse(mockResponse);

      await provider.complete({
        model: 'claude-3-5-sonnet',
        messages: mockMessages,
        userId: 'user-123'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.system).toBe('You are a helpful assistant.');
      expect(requestBody.messages).toHaveLength(1);
      expect(requestBody.messages[0].role).toBe('user');
      expect(requestBody.messages[0].content).toBe('Hello, Claude!');
    });

    it('should handle API errors', async () => {
      mockFetchResponse({ error: 'Invalid request' }, 400);

      await expect(provider.complete({
        model: 'claude-3-5-sonnet',
        messages: mockMessages,
        userId: 'user-123'
      })).rejects.toThrow('Anthropic API error');
    });
  });

  describe('streamComplete', () => {
    const mockMessages = [
      { role: 'user', content: 'Write a short poem' }
    ];

    it('should stream completion successfully', async () => {
      const chunks = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n\n',
        'data: {"type":"content_block_delta","delta":{"text":"Roses"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"text":" are red"}}\n\n',
        'data: {"type":"message_delta","delta":{"usage":{"output_tokens":5}}}\n\n',
        'data: {"type":"message_stop"}\n\n'
      ];

      mockStreamingFetchResponse(chunks);

      const receivedChunks: string[] = [];
      let completionResult: any = null;

      await provider.streamComplete({
        model: 'claude-3-5-sonnet',
        messages: mockMessages,
        userId: 'user-123',
        onStreamChunk: (chunk) => {
          receivedChunks.push(chunk);
        },
        onStreamComplete: (result) => {
          completionResult = result;
        }
      });

      expect(receivedChunks).toEqual(['Roses', ' are red']);
      expect(completionResult).not.toBeNull();
      expect(completionResult.choices[0].message.content).toBe('Roses are red');
      expect(completionResult.usage.prompt_tokens).toBe(10);
      expect(completionResult.usage.completion_tokens).toBe(5);
    });

    it('should require onStreamChunk callback', async () => {
      await expect(provider.streamComplete({
        model: 'claude-3-5-sonnet',
        messages: mockMessages,
        userId: 'user-123'
      })).rejects.toThrow('onStreamChunk callback required for streaming');
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for claude-3-5-sonnet correctly', () => {
      const cost = provider.calculateCost('claude-3-5-sonnet', 1000, 500);
      // claude-3-5-sonnet: $3.00 input, $15.00 output per 1M tokens
      // Input: 1000 * (3.00/1000000) = 0.003
      // Output: 500 * (15.00/1000000) = 0.0075
      // Total: 0.0105
      expect(cost).toBeCloseTo(0.0105, 6);
    });

    it('should calculate cost for claude-3-5-haiku correctly', () => {
      const cost = provider.calculateCost('claude-3-5-haiku', 1000, 500);
      // claude-3-5-haiku: $0.25 input, $1.25 output per 1M tokens
      // Input: 1000 * (0.25/1000000) = 0.00025
      // Output: 500 * (1.25/1000000) = 0.000625
      // Total: 0.000875
      expect(cost).toBeCloseTo(0.000875, 6);
    });

    it('should fallback to claude-3-5-haiku pricing for unknown models', () => {
      const cost = provider.calculateCost('unknown-model', 1000, 500);
      expect(cost).toBeCloseTo(0.000875, 6);
    });
  });

  describe('mapModelName', () => {
    it('should map known models correctly', () => {
      const mapModelName = (provider as any).mapModelName.bind(provider);
      
      expect(mapModelName('claude-3-5-sonnet')).toBe('claude-3-5-sonnet-20241022');
      expect(mapModelName('claude-3-5-haiku')).toBe('claude-3-5-haiku-20241022');
    });

    it('should fallback to claude-3-5-haiku for unknown models', () => {
      const mapModelName = (provider as any).mapModelName.bind(provider);
      expect(mapModelName('unknown-model')).toBe('claude-3-5-haiku-20241022');
    });
  });

  describe('convertMessages', () => {
    it('should separate system and conversation messages', () => {
      const convertMessages = (provider as any).convertMessages.bind(provider);
      
      const messages = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = convertMessages(messages);
      
      expect(result.system).toBe('You are helpful.');
      expect(result.conversationMessages).toHaveLength(3);
      expect(result.conversationMessages[0].role).toBe('user');
      expect(result.conversationMessages[1].role).toBe('assistant');
      expect(result.conversationMessages[2].role).toBe('user');
    });

    it('should handle messages without system prompt', () => {
      const convertMessages = (provider as any).convertMessages.bind(provider);
      
      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const result = convertMessages(messages);
      
      expect(result.system).toBe('');
      expect(result.conversationMessages).toHaveLength(1);
    });
  });

  describe('mapFinishReason', () => {
    it('should map finish reasons correctly', () => {
      const mapFinishReason = (provider as any).mapFinishReason.bind(provider);
      
      expect(mapFinishReason('end_turn')).toBe('stop');
      expect(mapFinishReason('max_tokens')).toBe('length');
      expect(mapFinishReason('stop_sequence')).toBe('stop');
      expect(mapFinishReason('unknown')).toBe('stop');
    });
  });
});