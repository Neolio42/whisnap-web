import { OpenAITranscriptionProvider } from '../../src/providers/transcription/openai';
import { OpenAIProvider } from '../../src/providers/llm/openai';
import fs from 'fs';
import path from 'path';

// Skip tests if no API key
const skipIfNoKey = () => {
  if (!process.env.OPENAI_API_KEY) {
    console.log('🚫 Skipping OpenAI integration tests - no API key');
    return true;
  }
  return false;
};

describe('OpenAI Integration Tests', () => {
  let transcriptionProvider: OpenAITranscriptionProvider;
  let llmProvider: OpenAIProvider;

  beforeAll(() => {
    if (skipIfNoKey()) return;
    
    transcriptionProvider = new OpenAITranscriptionProvider();
    llmProvider = new OpenAIProvider();
  });

  describe('OpenAI Transcription (Whisper) - REAL API', () => {
    it('should transcribe a real audio file', async () => {
      if (skipIfNoKey()) return;

      // Load real audio file
      const audioPath = path.join(__dirname, '../fixtures/test-audio.wav');
      const testAudio = fs.readFileSync(audioPath);

      console.log('🎵 Testing OpenAI Whisper with REAL audio file...');
      console.log(`Audio file: ${audioPath}`);
      console.log(`Audio size: ${testAudio.length} bytes`);

      const result = await transcriptionProvider.transcribe({
        audio: testAudio,
        userId: 'test-user',
        language: 'en'
      });

      console.log('✅ Transcription result:', result);

      expect(result.text).toBeDefined();
      expect(result.provider).toBe('whisper-api');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.cost).toBeDefined();

      // For silence, we might get empty string or a simple response
      console.log(`📝 Transcribed text: "${result.text}"`);
      console.log(`💰 Cost: $${result.cost}`);
      console.log(`⏱️ Duration: ${result.duration}s`);

    }, 30000); // 30 second timeout for API call

    it('should validate audio buffer requirements', async () => {
      if (skipIfNoKey()) return;

      await expect(transcriptionProvider.transcribe({
        audio: Buffer.alloc(0),
        userId: 'test-user'
      })).rejects.toThrow('Audio buffer is required');
    });

    it('should validate file size limits', async () => {
      if (skipIfNoKey()) return;

      // Create a buffer larger than 25MB
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024);

      await expect(transcriptionProvider.transcribe({
        audio: largeBuffer,
        userId: 'test-user'
      })).rejects.toThrow('File size exceeds maximum limit');
    });
  });

  describe('OpenAI LLM (GPT) - REAL API', () => {
    it('should complete a simple chat with GPT-4o-mini', async () => {
      if (skipIfNoKey()) return;

      console.log('🤖 Testing OpenAI GPT-4o-mini...');

      const result = await llmProvider.complete({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Say "Hello test!" and nothing else.' }
        ],
        max_tokens: 10,
        temperature: 0.1,
        userId: 'test-user'
      });

      console.log('✅ LLM result:', result);

      expect(result.choices).toHaveLength(1);
      expect(result.choices[0]).toBeDefined();
      expect(result.choices[0]!.message.content).toBeDefined();
      expect(result.choices[0]!.message.role).toBe('assistant');
      expect(result.usage).toBeDefined();
      expect(result.usage!.prompt_tokens).toBeGreaterThan(0);
      expect(result.usage!.completion_tokens).toBeGreaterThan(0);
      expect(result.usage!.total_tokens).toBeGreaterThan(0);

      console.log(`🎯 Response: "${result.choices[0]!.message.content}"`);
      console.log(`📊 Token usage: ${result.usage!.prompt_tokens} → ${result.usage!.completion_tokens} (${result.usage!.total_tokens} total)`);

      // Calculate real cost
      const cost = llmProvider.calculateCost('gpt-4o-mini', result.usage!.prompt_tokens, result.usage!.completion_tokens);
      console.log(`💰 Calculated cost: $${cost.toFixed(6)}`);

    }, 15000); // 15 second timeout

    it('should handle system messages correctly', async () => {
      if (skipIfNoKey()) return;

      const result = await llmProvider.complete({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Always respond with exactly one word.' },
          { role: 'user', content: 'What is the capital of France?' }
        ],
        max_tokens: 5,
        temperature: 0,
        userId: 'test-user'
      });

      expect(result.choices[0]).toBeDefined();
      expect(result.choices[0]!.message.content).toBeDefined();
      expect(result.choices[0]!.message.content.trim().split(' ')).toHaveLength(1);
      
      console.log(`🎯 One-word response: "${result.choices[0]!.message.content}"`);
    });

    it('should calculate costs correctly', () => {
      if (skipIfNoKey()) return;

      // Test cost calculation for gpt-4o-mini
      const cost = llmProvider.calculateCost('gpt-4o-mini', 1000, 500);
      
      // gpt-4o-mini: $0.15 input, $0.60 output per 1M tokens
      // Expected: (1000 * 0.15/1M) + (500 * 0.60/1M) = 0.00015 + 0.0003 = 0.00045
      expect(cost).toBeCloseTo(0.00045, 6);

      console.log(`💰 Cost for 1000→500 tokens: $${cost.toFixed(6)}`);
    });
  });

  describe('Error Handling - REAL API', () => {
    it('should handle invalid API key gracefully', async () => {
      if (skipIfNoKey()) return;

      // Temporarily replace the API key
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'sk-invalid-key-test';

      const invalidProvider = new OpenAIProvider();

      // Restore the key immediately
      process.env.OPENAI_API_KEY = originalKey;

      await expect(invalidProvider.complete({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        userId: 'test-user'
      })).rejects.toThrow('OpenAI API error');
    });
  });
});