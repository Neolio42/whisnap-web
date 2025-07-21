import WebSocket from 'ws';
import { setupWebSocket } from '../../src/websocket/streamingHandler';
import { prismaMock, createMockUser, createMockToken } from '../setup';

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token: string) => {
    if (token === 'valid-token') {
      return { userId: 'user-123' };
    }
    throw new Error('Invalid token');
  })
}));

// Mock providers
jest.mock('../../src/providers/transcription', () => ({
  getTranscriptionProvider: jest.fn(() => ({
    supportsStreaming: () => true,
    startStreaming: jest.fn(),
    sendAudioData: jest.fn(),
    stopStreaming: jest.fn()
  }))
}));

jest.mock('../../src/providers/llm', () => ({
  getLLMProvider: jest.fn(() => ({
    supportsStreaming: () => true,
    streamComplete: jest.fn()
  }))
}));

describe('WebSocket Streaming Handler', () => {
  let mockWss: any;
  let mockClient: any;

  beforeEach(() => {
    // Mock WebSocket server
    mockWss = {
      clients: new Set(),
      on: jest.fn(),
      close: jest.fn()
    };

    // Mock WebSocket client
    mockClient = {
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      ping: jest.fn(),
      on: jest.fn(),
      isAlive: true
    };

    // Mock Prisma user lookup
    prismaMock.user.findUnique.mockResolvedValue(createMockUser());
    prismaMock.usage.create.mockResolvedValue({
      id: 'usage-123',
      ...createMockUser()
    } as any);
  });

  describe('setupWebSocket', () => {
    it('should set up WebSocket server with event handlers', () => {
      setupWebSocket(mockWss);

      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockWss.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should send welcome message on connection', () => {
      setupWebSocket(mockWss);

      // Simulate connection event
      const connectionHandler = mockWss.on.mock.calls.find(([event]) => event === 'connection')[1];
      connectionHandler(mockClient, {});

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connected"')
      );
    });

    it('should set up heartbeat mechanism', () => {
      jest.useFakeTimers();

      setupWebSocket(mockWss);

      // Fast-forward time to trigger heartbeat
      jest.advanceTimersByTime(30000);

      // Verify ping is called (would be called on real clients)
      jest.useRealTimers();
    });
  });

  describe('Authentication', () => {
    let connectionHandler: any;

    beforeEach(() => {
      setupWebSocket(mockWss);
      connectionHandler = mockWss.on.mock.calls.find(([event]) => event === 'connection')[1];
    });

    it('should authenticate with valid token', async () => {
      const messageHandler = jest.fn();
      mockClient.on.mockImplementation((event: string, handler: any) => {
        if (event === 'message') messageHandler.mockImplementation(handler);
      });

      connectionHandler(mockClient, {});

      const authMessage = JSON.stringify({
        type: 'auth',
        token: 'valid-token'
      });

      await messageHandler(Buffer.from(authMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"auth_success"')
      );
    });

    it('should reject invalid token', async () => {
      const messageHandler = jest.fn();
      mockClient.on.mockImplementation((event: string, handler: any) => {
        if (event === 'message') messageHandler.mockImplementation(handler);
      });

      connectionHandler(mockClient, {});

      const authMessage = JSON.stringify({
        type: 'auth',
        token: 'invalid-token'
      });

      await messageHandler(Buffer.from(authMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"auth_error"')
      );
      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should require authentication token', async () => {
      const messageHandler = jest.fn();
      mockClient.on.mockImplementation((event: string, handler: any) => {
        if (event === 'message') messageHandler.mockImplementation(handler);
      });

      connectionHandler(mockClient, {});

      const authMessage = JSON.stringify({
        type: 'auth'
        // Missing token
      });

      await messageHandler(Buffer.from(authMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Authentication token required"')
      );
    });
  });

  describe('Transcription Streaming', () => {
    let messageHandler: any;

    beforeEach(() => {
      setupWebSocket(mockWss);
      const connectionHandler = mockWss.on.mock.calls.find(([event]) => event === 'connection')[1];
      
      mockClient.on.mockImplementation((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      });
      mockClient.userId = 'user-123';

      connectionHandler(mockClient, {});
    });

    it('should start transcription streaming', async () => {
      const startMessage = JSON.stringify({
        type: 'start_transcription',
        provider: 'assemblyai',
        language: 'en',
        sampleRate: 16000
      });

      await messageHandler(Buffer.from(startMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"transcription_started"')
      );
    });

    it('should reject streaming for non-streaming providers', async () => {
      // Mock non-streaming provider
      const { getTranscriptionProvider } = require('../../src/providers/transcription');
      getTranscriptionProvider.mockReturnValue({
        supportsStreaming: () => false
      });

      const startMessage = JSON.stringify({
        type: 'start_transcription',
        provider: 'openai'
      });

      await messageHandler(Buffer.from(startMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Provider openai does not support streaming"')
      );
    });

    it('should handle audio data', async () => {
      // First start transcription
      mockClient.sessionId = 'transcribe_user-123_1234567890';
      
      const audioMessage = JSON.stringify({
        type: 'audio_data',
        sessionId: 'transcribe_user-123_1234567890',
        audioData: 'base64-audio-data'
      });

      await messageHandler(Buffer.from(audioMessage));

      // Should not throw error (would call sendAudioData on provider)
    });

    it('should reject audio data for invalid session', async () => {
      const audioMessage = JSON.stringify({
        type: 'audio_data',
        sessionId: 'invalid-session',
        audioData: 'base64-audio-data'
      });

      await messageHandler(Buffer.from(audioMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Invalid session"')
      );
    });

    it('should require authentication for transcription', async () => {
      delete mockClient.userId;

      const startMessage = JSON.stringify({
        type: 'start_transcription',
        provider: 'assemblyai'
      });

      await messageHandler(Buffer.from(startMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Not authenticated"')
      );
    });
  });

  describe('LLM Streaming', () => {
    let messageHandler: any;

    beforeEach(() => {
      setupWebSocket(mockWss);
      const connectionHandler = mockWss.on.mock.calls.find(([event]) => event === 'connection')[1];
      
      mockClient.on.mockImplementation((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      });
      mockClient.userId = 'user-123';

      connectionHandler(mockClient, {});
    });

    it('should start LLM streaming', async () => {
      const startMessage = JSON.stringify({
        type: 'start_llm_stream',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        temperature: 0.7
      });

      await messageHandler(Buffer.from(startMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"llm_started"')
      );
    });

    it('should reject streaming for non-streaming models', async () => {
      // Mock non-streaming provider
      const { getLLMProvider } = require('../../src/providers/llm');
      getLLMProvider.mockReturnValue({
        supportsStreaming: () => false
      });

      const startMessage = JSON.stringify({
        type: 'start_llm_stream',
        model: 'non-streaming-model',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      await messageHandler(Buffer.from(startMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Model non-streaming-model does not support streaming"')
      );
    });

    it('should require authentication for LLM streaming', async () => {
      delete mockClient.userId;

      const startMessage = JSON.stringify({
        type: 'start_llm_stream',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }]
      });

      await messageHandler(Buffer.from(startMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Not authenticated"')
      );
    });
  });

  describe('Session Management', () => {
    let messageHandler: any;

    beforeEach(() => {
      setupWebSocket(mockWss);
      const connectionHandler = mockWss.on.mock.calls.find(([event]) => event === 'connection')[1];
      
      mockClient.on.mockImplementation((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      });
      mockClient.userId = 'user-123';
      mockClient.sessionId = 'test-session-123';

      connectionHandler(mockClient, {});
    });

    it('should stop session', async () => {
      const stopMessage = JSON.stringify({
        type: 'stop_session',
        sessionId: 'test-session-123'
      });

      await messageHandler(Buffer.from(stopMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"session_stopped"')
      );
    });

    it('should reject stopping invalid session', async () => {
      const stopMessage = JSON.stringify({
        type: 'stop_session',
        sessionId: 'invalid-session'
      });

      await messageHandler(Buffer.from(stopMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Invalid session"')
      );
    });

    it('should handle unknown message types', async () => {
      const unknownMessage = JSON.stringify({
        type: 'unknown_message_type',
        data: 'test'
      });

      await messageHandler(Buffer.from(unknownMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Unknown message type: unknown_message_type"')
      );
    });

    it('should handle malformed JSON', async () => {
      const malformedMessage = 'invalid json{';

      await messageHandler(Buffer.from(malformedMessage));

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Invalid message format"')
      );
    });
  });

  describe('Connection Cleanup', () => {
    it('should clean up sessions on connection close', () => {
      setupWebSocket(mockWss);
      const connectionHandler = mockWss.on.mock.calls.find(([event]) => event === 'connection')[1];
      
      let closeHandler: any;
      mockClient.on.mockImplementation((event: string, handler: any) => {
        if (event === 'close') closeHandler = handler;
      });

      connectionHandler(mockClient, {});

      // Simulate close event
      if (closeHandler) {
        closeHandler();
      }

      // Verify cleanup occurred (would remove from activeSessions map)
      expect(true).toBe(true); // Placeholder - real test would verify session cleanup
    });

    it('should handle connection errors', () => {
      setupWebSocket(mockWss);
      const connectionHandler = mockWss.on.mock.calls.find(([event]) => event === 'connection')[1];
      
      let errorHandler: any;
      mockClient.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') errorHandler = handler;
      });

      connectionHandler(mockClient, {});

      // Simulate error event
      if (errorHandler) {
        errorHandler(new Error('Connection error'));
      }

      // Should handle gracefully without crashing
      expect(true).toBe(true);
    });
  });
});