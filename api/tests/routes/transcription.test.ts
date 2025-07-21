import request from 'supertest';
import express from 'express';
import transcriptionRoutes from '../../src/routes/transcription';
import { prismaMock, createMockUser, mockFetchResponse } from '../setup';

// Mock middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    req.user = createMockUser();
    next();
  }
}));

jest.mock('../../src/middleware/rateLimit', () => ({
  rateLimitTranscription: (req: any, res: any, next: any) => next()
}));

jest.mock('../../src/middleware/usage', () => ({
  trackUsage: (service: string) => (req: any, res: any, next: any) => next()
}));

// Mock multer middleware
jest.mock('multer', () => {
  return jest.fn(() => ({
    single: jest.fn(() => (req: any, res: any, next: any) => {
      // Mock file upload
      req.file = {
        buffer: Buffer.from('fake audio data'),
        originalname: 'test.mp3',
        mimetype: 'audio/mpeg',
        size: 1024 * 1024 // 1MB
      };
      next();
    })
  }));
});

describe('Transcription Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/transcription', transcriptionRoutes);
  });

  describe('GET /transcription/providers', () => {
    it('should return available providers', async () => {
      const response = await request(app)
        .get('/transcription/providers')
        .expect(200);

      expect(response.body.providers).toBeDefined();
      expect(Array.isArray(response.body.providers)).toBe(true);
      expect(response.body.providers.length).toBeGreaterThan(0);

      const provider = response.body.providers[0];
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('supportsStreaming');
      expect(provider).toHaveProperty('supportedFormats');
      expect(provider).toHaveProperty('maxFileSize');
      expect(provider).toHaveProperty('features');
    });
  });

  describe('POST /transcription/transcribe', () => {
    beforeEach(() => {
      // Mock OpenAI Whisper API response
      mockFetchResponse({
        text: 'This is a test transcription of the audio file.',
        duration: 5.2
      });
    });

    it('should transcribe audio file successfully', async () => {
      const response = await request(app)
        .post('/transcription/transcribe')
        .attach('audio', Buffer.from('fake audio data'), 'test.mp3')
        .field('language', 'en')
        .expect(200);

      expect(response.body.text).toBe('This is a test transcription of the audio file.');
      expect(response.body.provider).toBeDefined();
      expect(response.body.duration).toBeGreaterThan(0);
      expect(response.body.cost).toBeDefined();
      expect(response.body.metadata).toBeDefined();
    });

    it('should auto-select provider when not specified', async () => {
      const response = await request(app)
        .post('/transcription/transcribe')
        .attach('audio', Buffer.from('fake audio data'), 'test.mp3')
        .expect(200);

      expect(response.body.provider).toBeDefined();
      // Should use openai as default auto-selection
    });

    it('should use specified provider', async () => {
      const response = await request(app)
        .post('/transcription/transcribe')
        .attach('audio', Buffer.from('fake audio data'), 'test.mp3')
        .field('provider', 'openai')
        .expect(200);

      expect(response.body.provider).toBe('openai');
    });

    it('should handle translation task', async () => {
      const response = await request(app)
        .post('/transcription/transcribe')
        .attach('audio', Buffer.from('fake audio data'), 'test.mp3')
        .field('task', 'translate')
        .field('language', 'es')
        .expect(200);

      expect(response.body.text).toBeDefined();
    });

    it('should handle different output formats', async () => {
      mockFetchResponse({
        text: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest transcription'
      });

      const response = await request(app)
        .post('/transcription/transcribe')
        .attach('audio', Buffer.from('fake audio data'), 'test.mp3')
        .field('format', 'vtt')
        .expect(200);

      expect(response.body.text).toContain('WEBVTT');
    });

    it('should require audio file', async () => {
      const response = await request(app)
        .post('/transcription/transcribe')
        .expect(400);

      expect(response.body.error).toBe('Audio file is required');
    });

    it('should handle API errors', async () => {
      mockFetchResponse({ error: 'Invalid audio format' }, 400);

      const response = await request(app)
        .post('/transcription/transcribe')
        .attach('audio', Buffer.from('fake audio data'), 'test.mp3')
        .expect(500);

      expect(response.body.error).toBe('Transcription failed');
    });
  });

  describe('POST /transcription/stream/start', () => {
    it('should start streaming session for compatible provider', async () => {
      const response = await request(app)
        .post('/transcription/stream/start')
        .send({
          provider: 'assemblyai',
          language: 'en',
          sampleRate: 16000
        })
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.provider).toBe('assemblyai');
      expect(response.body.status).toBe('ready');
      expect(response.body.websocketUrl).toContain('ws://');
    });

    it('should reject non-streaming providers', async () => {
      const response = await request(app)
        .post('/transcription/stream/start')
        .send({
          provider: 'openai', // OpenAI doesn't support streaming in our implementation
          language: 'en'
        })
        .expect(400);

      expect(response.body.error).toBe('Provider does not support streaming');
      expect(response.body.suggestion).toContain('assemblyai or deepgram');
    });

    it('should use default provider if not specified', async () => {
      const response = await request(app)
        .post('/transcription/stream/start')
        .send({
          language: 'en'
        })
        .expect(200);

      expect(response.body.provider).toBe('assemblyai');
    });

    it('should include session metadata', async () => {
      const response = await request(app)
        .post('/transcription/stream/start')
        .send({
          provider: 'assemblyai',
          language: 'en',
          sampleRate: 16000
        })
        .expect(200);

      expect(response.body.sessionId).toMatch(/^stream_user-123_\d+$/);
      expect(response.body.websocketUrl).toContain(response.body.sessionId);
    });
  });

  describe('GET /transcription/stream/:sessionId/status', () => {
    const mockSessionId = 'stream_user-123_1234567890';

    it('should return session status for valid session', async () => {
      const response = await request(app)
        .get(`/transcription/stream/${mockSessionId}/status`)
        .expect(200);

      expect(response.body.sessionId).toBe(mockSessionId);
      expect(response.body.status).toBe('active');
      expect(response.body.duration).toBeGreaterThanOrEqual(0);
      expect(response.body.transcriptCount).toBeDefined();
    });

    it('should reject access to other users sessions', async () => {
      const otherUserSessionId = 'stream_other-user_1234567890';

      const response = await request(app)
        .get(`/transcription/stream/${otherUserSessionId}/status`)
        .expect(403);

      expect(response.body.error).toBe('Access denied to this session');
    });
  });

  describe('POST /transcription/stream/:sessionId/stop', () => {
    const mockSessionId = 'stream_user-123_1234567890';

    it('should stop session for valid session', async () => {
      const response = await request(app)
        .post(`/transcription/stream/${mockSessionId}/stop`)
        .expect(200);

      expect(response.body.sessionId).toBe(mockSessionId);
      expect(response.body.status).toBe('stopped');
      expect(response.body.finalTranscript).toBeDefined();
      expect(response.body.totalDuration).toBeDefined();
      expect(response.body.totalCost).toBeDefined();
    });

    it('should reject access to other users sessions', async () => {
      const otherUserSessionId = 'stream_other-user_1234567890';

      const response = await request(app)
        .post(`/transcription/stream/${otherUserSessionId}/stop`)
        .expect(403);

      expect(response.body.error).toBe('Access denied to this session');
    });
  });
});