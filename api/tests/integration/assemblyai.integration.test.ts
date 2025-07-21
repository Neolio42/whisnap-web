import { AssemblyAIProvider } from '../../src/providers/transcription/assemblyai';

// Skip tests if no API key
const skipIfNoKey = () => {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    console.log('🚫 Skipping AssemblyAI integration tests - no API key');
    return true;
  }
  return false;
};

describe('AssemblyAI Integration Tests', () => {
  let provider: AssemblyAIProvider;

  beforeAll(() => {
    if (skipIfNoKey()) return;
    provider = new AssemblyAIProvider();
  });

  describe('AssemblyAI Transcription - REAL API', () => {
    it.skip('should transcribe using AssemblyAI', async () => {
      if (skipIfNoKey()) return;

      // Create a minimal WAV file (1 second of silence)
      const wavHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x7D, 0x00, 0x00, // File size
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        0x66, 0x6D, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Subchunk1Size
        0x01, 0x00, // AudioFormat (PCM)
        0x01, 0x00, // NumChannels (mono)
        0x80, 0x3E, 0x00, 0x00, // SampleRate (16000)
        0x00, 0x7D, 0x00, 0x00, // ByteRate
        0x02, 0x00, // BlockAlign
        0x10, 0x00, // BitsPerSample (16)
        0x64, 0x61, 0x74, 0x61, // "data"
        0x00, 0x7D, 0x00, 0x00, // Subchunk2Size
      ]);

      const silenceData = Buffer.alloc(32000, 0); // 1 second of silence
      const testAudio = Buffer.concat([wavHeader, silenceData]);

      console.log('🎵 Testing AssemblyAI transcription...');
      console.log(`Audio size: ${testAudio.length} bytes`);

      const result = await provider.transcribe({
        audio: testAudio,
        userId: 'test-user',
        language: 'en'
      });

      console.log('✅ AssemblyAI result:', result);

      expect(result.text).toBeDefined();
      expect(result.provider).toBe('assemblyai-streaming');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.cost).toBeDefined();

      console.log(`📝 Transcribed text: "${result.text}"`);
      console.log(`💰 Cost: $${result.cost}`);
      console.log(`⏱️ Duration: ${result.duration}s`);

    }, 60000); // 60 second timeout (AssemblyAI can be slower)

    it('should support streaming capability', () => {
      if (skipIfNoKey()) return;

      expect(provider.supportsStreaming()).toBe(true);
      console.log('✅ AssemblyAI supports streaming');
    });

    it('should have correct features', () => {
      if (skipIfNoKey()) return;

      const features = provider.getFeatures();
      expect(features).toContain('streaming');
      expect(features).toContain('real-time');
      
      console.log('🎯 AssemblyAI features:', features);
    });

    it('should calculate costs correctly', () => {
      if (skipIfNoKey()) return;

      // AssemblyAI pricing: ~$0.65/hour
      const cost = provider.calculateCost('assemblyai-streaming', 1.0, 60); // 1MB file, 1 minute
      
      // Expected: 60 seconds * ($0.65/3600) = $0.0108
      expect(cost).toBeCloseTo(0.0108, 4);

      console.log(`💰 Cost for 1 minute: $${cost.toFixed(6)}`);
    });
  });

  describe('AssemblyAI Validation', () => {
    it('should validate audio buffer', async () => {
      if (skipIfNoKey()) return;

      await expect(provider.transcribe({
        audio: Buffer.alloc(0),
        userId: 'test-user'
      })).rejects.toThrow();
    });

    it('should have correct model name', () => {
      if (skipIfNoKey()) return;

      expect(provider.getModelName()).toBe('best');
      console.log('🏷️ Model name:', provider.getModelName());
    });

    it('should have correct cost per hour', () => {
      if (skipIfNoKey()) return;

      expect(provider.getCostPerHour()).toBe(0.65);
      console.log('💰 Cost per hour: $' + provider.getCostPerHour());
    });
  });

  describe('Error Handling - REAL API', () => {
    it('should handle invalid API key', async () => {
      if (skipIfNoKey()) return;

      // Test with invalid key
      const originalKey = process.env.ASSEMBLYAI_API_KEY;
      process.env.ASSEMBLYAI_API_KEY = 'invalid-key-test';

      const invalidProvider = new AssemblyAIProvider();

      // Restore the key
      process.env.ASSEMBLYAI_API_KEY = originalKey;

      const testAudio = Buffer.from('fake audio data');

      await expect(invalidProvider.transcribe({
        audio: testAudio,
        userId: 'test-user'
      })).rejects.toThrow();
    });
  });
});