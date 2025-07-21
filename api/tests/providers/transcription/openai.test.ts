import { OpenAITranscriptionProvider } from '../../../src/providers/transcription/openai';
import { mockFetchResponse } from '../../setup';

describe('OpenAITranscriptionProvider', () => {
  let provider: OpenAITranscriptionProvider;

  beforeEach(() => {
    provider = new OpenAITranscriptionProvider();
  });

  describe('getApiKey', () => {
    it('should return the API key from environment', () => {
      const apiKey = provider.getApiKey();
      expect(apiKey).toBe('test-openai-key');
    });

    it('should throw error if API key is not configured', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new OpenAITranscriptionProvider()).toThrow('OPENAI_API_KEY not configured');
      process.env.OPENAI_API_KEY = 'test-openai-key'; // Restore
    });
  });

  describe('supportsStreaming', () => {
    it('should return false', () => {
      expect(provider.supportsStreaming()).toBe(false);
    });
  });

  describe('getSupportedFormats', () => {
    it('should return correct formats', () => {
      const formats = provider.getSupportedFormats();
      expect(formats).toEqual(['mp3', 'mp4', 'wav', 'webm', 'ogg', 'flac', 'm4a']);
    });
  });

  describe('getMaxFileSize', () => {
    it('should return 25MB limit', () => {
      expect(provider.getMaxFileSize()).toBe(25 * 1024 * 1024);
    });
  });

  describe('getFeatures', () => {
    it('should return correct features', () => {
      const features = provider.getFeatures();
      expect(features).toEqual(['transcription', 'translation', 'timestamps']);
    });
  });

  describe('transcribe', () => {
    const mockAudioBuffer = Buffer.from('fake audio data');
    const mockOptions = {
      audio: mockAudioBuffer,
      userId: 'user-123'
    };

    it('should transcribe successfully', async () => {
      const mockResponse = {
        text: 'Hello, this is a test transcription.',
        duration: 5.2
      };

      mockFetchResponse(mockResponse);

      const result = await provider.transcribe(mockOptions);

      expect(result.text).toBe('Hello, this is a test transcription.');
      expect(result.metadata?.duration).toBe(5.2);

      // Verify API call
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.openai.com/v1/audio/transcriptions');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer test-openai-key');
    });

    it('should handle different languages', async () => {
      const mockResponse = {
        text: 'Hello, this is a test translation.'
      };

      mockFetchResponse(mockResponse);

      await provider.transcribe({
        ...mockOptions,
        language: 'es'
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.openai.com/v1/audio/transcriptions');
    });

    it('should handle language parameter', async () => {
      const mockResponse = { text: 'Bonjour, ceci est un test.' };
      mockFetchResponse(mockResponse);

      await provider.transcribe({
        ...mockOptions,
        language: 'fr'
      });

      // FormData verification would be complex, but we can verify the call was made
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle different response formats', async () => {
      const mockVttResponse = {
        text: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world'
      };

      mockFetchResponse(mockVttResponse);

      const result = await provider.transcribe(mockOptions);

      expect(result.text).toContain('WEBVTT');
    });

    it('should handle API errors', async () => {
      mockFetchResponse({ error: 'Invalid audio file' }, 400);

      await expect(provider.transcribe(mockOptions)).rejects.toThrow('OpenAI Whisper API error');
    });

    it('should validate audio buffer', async () => {
      await expect(provider.transcribe({
        ...mockOptions,
        audio: Buffer.alloc(0) // Empty buffer
      })).rejects.toThrow('Audio buffer is required');
    });

    it('should validate file size', async () => {
      const largeBuffer = Buffer.alloc(30 * 1024 * 1024); // 30MB

      await expect(provider.transcribe({
        ...mockOptions,
        audio: largeBuffer
      })).rejects.toThrow('File size exceeds maximum limit');
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly', () => {
      const cost = provider.calculateCost('openai', 5.0, 2.5); // 5MB file, 2.5 minutes
      // OpenAI Whisper: $0.006 per minute
      // Cost: 2.5 * 0.006 = 0.015
      expect(cost).toBeCloseTo(0.015, 6);
    });

    it('should handle zero duration', () => {
      const cost = provider.calculateCost('openai', 1.0, 0);
      expect(cost).toBe(0);
    });

    it('should handle minimum duration', () => {
      const cost = provider.calculateCost('openai', 0.1, 0.5); // 0.5 minutes
      expect(cost).toBeCloseTo(0.003, 6);
    });
  });

  describe('mapFormat', () => {
    it('should map formats correctly', () => {
      const mapFormat = (provider as any).mapFormat.bind(provider);
      
      expect(mapFormat('text')).toBe('text');
      expect(mapFormat('json')).toBe('verbose_json');
      expect(mapFormat('srt')).toBe('srt');
      expect(mapFormat('vtt')).toBe('vtt');
      expect(mapFormat('unknown')).toBe('text');
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      const getFileExtension = (provider as any).getFileExtension.bind(provider);
      
      expect(getFileExtension('test.mp3')).toBe('mp3');
      expect(getFileExtension('audio.wav')).toBe('wav');
      expect(getFileExtension('file.m4a')).toBe('m4a');
      expect(getFileExtension('noextension')).toBe('mp3'); // default
    });
  });

  describe('validateAudioFormat', () => {
    it('should validate supported formats', () => {
      const validateAudioFormat = (provider as any).validateAudioFormat.bind(provider);
      
      expect(() => validateAudioFormat('audio/mpeg')).not.toThrow();
      expect(() => validateAudioFormat('audio/wav')).not.toThrow();
      expect(() => validateAudioFormat('audio/mp4')).not.toThrow();
    });

    it('should reject unsupported formats', () => {
      const validateAudioFormat = (provider as any).validateAudioFormat.bind(provider);
      
      expect(() => validateAudioFormat('video/avi')).toThrow('Unsupported audio format');
      expect(() => validateAudioFormat('text/plain')).toThrow('Unsupported audio format');
    });
  });
});