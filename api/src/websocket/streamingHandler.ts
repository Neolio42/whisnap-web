import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { getTranscriptionProvider } from '../providers/transcription';
import { getLLMProvider } from '../providers/llm';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WebSocketClient extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAlive?: boolean;
}

interface StreamingSession {
  id: string;
  userId: string;
  type: 'transcription' | 'llm';
  provider: string;
  startTime: number;
  client: WebSocketClient;
  options: any;
}

const activeSessions = new Map<string, StreamingSession>();

export function setupWebSocket(wss: WebSocketServer) {
  console.log('🔄 Setting up WebSocket server for streaming...');

  // Heartbeat to detect broken connections
  const heartbeat = () => {
    wss.clients.forEach((client: WebSocketClient) => {
      if (client.isAlive === false) {
        console.log('💔 Terminating dead WebSocket connection');
        return client.terminate();
      }
      
      client.isAlive = false;
      client.ping();
    });
  };

  const interval = setInterval(heartbeat, 30000); // 30 seconds

  wss.on('connection', async (ws: WebSocketClient, request) => {
    console.log('🔗 New WebSocket connection');
    
    ws.isAlive = true;
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await handleWebSocketMessage(ws, data);
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      
      // Clean up any active sessions for this client
      for (const [sessionId, session] of activeSessions.entries()) {
        if (session.client === ws) {
          console.log(`🧹 Cleaning up session: ${sessionId}`);
          activeSessions.delete(sessionId);
          
          // Save session summary to database
          saveSessionSummary(session).catch(console.error);
        }
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    }));
  });

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('✅ WebSocket server setup complete');
}

async function handleWebSocketMessage(ws: WebSocketClient, data: any) {
  const { type, ...payload } = data;

  switch (type) {
    case 'auth':
      await handleAuth(ws, payload);
      break;
      
    case 'start_transcription':
      await handleStartTranscription(ws, payload);
      break;
      
    case 'audio_data':
      await handleAudioData(ws, payload);
      break;
      
    case 'start_llm_stream':
      await handleStartLLMStream(ws, payload);
      break;
      
    case 'stop_session':
      await handleStopSession(ws, payload);
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${type}`
      }));
  }
}

async function handleAuth(ws: WebSocketClient, payload: any) {
  try {
    const { token } = payload;
    
    if (!token) {
      throw new Error('Authentication token required');
    }

    const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT secret not configured');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId || decoded.sub }
    });

    if (!user) {
      throw new Error('User not found');
    }

    ws.userId = user.id;
    
    ws.send(JSON.stringify({
      type: 'auth_success',
      userId: user.id,
      plan: user.plan
    }));

    console.log(`🔐 WebSocket authenticated for user: ${user.id}`);

  } catch (error) {
    console.error('❌ WebSocket auth error:', error);
    ws.send(JSON.stringify({
      type: 'auth_error',
      error: error instanceof Error ? error.message : 'Authentication failed'
    }));
    ws.close(1008, 'Authentication failed');
  }
}

async function handleStartTranscription(ws: WebSocketClient, payload: any) {
  try {
    if (!ws.userId) {
      throw new Error('Not authenticated');
    }

    const { provider = 'assemblyai', language, sampleRate = 16000, sessionId } = payload;
    
    // Use provided session ID from HTTP endpoint, or create new one if not provided
    const finalSessionId = sessionId || `transcribe_${ws.userId}_${Date.now()}`;

    const transcriptionProvider = getTranscriptionProvider(provider);
    
    if (!transcriptionProvider.supportsStreaming()) {
      throw new Error(`Provider ${provider} does not support streaming`);
    }

    const session: StreamingSession = {
      id: finalSessionId,
      userId: ws.userId,
      type: 'transcription',
      provider,
      startTime: Date.now(),
      client: ws,
      options: { language, sampleRate }
    };

    activeSessions.set(finalSessionId, session);
    ws.sessionId = finalSessionId;

    // Initialize streaming with provider
    const streamOptions = {
      language,
      sampleRate,
      userId: ws.userId,
      sessionId: finalSessionId,
      onTranscript: (transcript: any) => {
        ws.send(JSON.stringify({
          type: 'transcript',
          sessionId: finalSessionId,
          data: transcript,
          timestamp: new Date().toISOString()
        }));
      },
      onPartialTranscript: (partial: any) => {
        ws.send(JSON.stringify({
          type: 'partial_transcript',
          sessionId: finalSessionId,
          data: partial,
          timestamp: new Date().toISOString()
        }));
      },
      onError: (error: Error) => {
        ws.send(JSON.stringify({
          type: 'transcription_error',
          sessionId: finalSessionId,
          error: error.message
        }));
      },
      onReady: () => {
        // Only notify frontend when provider is actually ready
        ws.send(JSON.stringify({
          type: 'transcription_started',
          sessionId: finalSessionId,
          provider,
          status: 'ready'
        }));
        console.log(`🎤 Transcription ready for session: ${finalSessionId}`);
      }
    };

    await transcriptionProvider.startStreaming?.(streamOptions);
    console.log(`🎤 Started transcription session: ${finalSessionId}`);

  } catch (error) {
    console.error('❌ Failed to start transcription:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to start transcription'
    }));
  }
}

async function handleAudioData(ws: WebSocketClient, payload: any) {
  try {
    const { sessionId, audioData } = payload;
    
    if (!sessionId || !ws.sessionId || sessionId !== ws.sessionId) {
      throw new Error('Invalid session');
    }

    const session = activeSessions.get(sessionId);
    if (!session || session.type !== 'transcription') {
      throw new Error('Transcription session not found');
    }

    const transcriptionProvider = getTranscriptionProvider(session.provider as any);
    await transcriptionProvider.sendAudioData?.(sessionId, audioData);

  } catch (error) {
    console.error('❌ Failed to handle audio data:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to process audio data'
    }));
  }
}

async function handleStartLLMStream(ws: WebSocketClient, payload: any) {
  try {
    if (!ws.userId) {
      throw new Error('Not authenticated');
    }

    const { model, messages, max_tokens = 1000, temperature = 0.7 } = payload;
    const sessionId = `llm_${ws.userId}_${Date.now()}`;

    const provider = getLLMProvider(model);
    
    if (!provider.supportsStreaming()) {
      throw new Error(`Model ${model} does not support streaming`);
    }

    const session: StreamingSession = {
      id: sessionId,
      userId: ws.userId,
      type: 'llm',
      provider: model,
      startTime: Date.now(),
      client: ws,
      options: { model, messages, max_tokens, temperature }
    };

    activeSessions.set(sessionId, session);
    ws.sessionId = sessionId;

    const streamOptions = {
      model,
      messages,
      max_tokens,
      temperature,
      userId: ws.userId,
      onStreamChunk: (chunk: string) => {
        ws.send(JSON.stringify({
          type: 'llm_chunk',
          sessionId,
          content: chunk,
          timestamp: new Date().toISOString()
        }));
      },
      onStreamComplete: (result: any) => {
        ws.send(JSON.stringify({
          type: 'llm_complete',
          sessionId,
          result,
          timestamp: new Date().toISOString()
        }));
        
        // Clean up session
        activeSessions.delete(sessionId);
        saveSessionSummary(session).catch(console.error);
      }
    };

    await provider.streamComplete?.(streamOptions);

    ws.send(JSON.stringify({
      type: 'llm_started',
      sessionId,
      model,
      status: 'streaming'
    }));

    console.log(`🤖 Started LLM stream session: ${sessionId}`);

  } catch (error) {
    console.error('❌ Failed to start LLM stream:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to start LLM stream'
    }));
  }
}

async function handleStopSession(ws: WebSocketClient, payload: any) {
  try {
    const { sessionId } = payload;
    
    if (!sessionId || !ws.sessionId || sessionId !== ws.sessionId) {
      throw new Error('Invalid session');
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Stop the session based on type
    if (session.type === 'transcription') {
      const transcriptionProvider = getTranscriptionProvider(session.provider as any);
      await transcriptionProvider.stopStreaming?.(sessionId);
    }

    // Clean up
    activeSessions.delete(sessionId);
    ws.sessionId = undefined;

    // Save session summary
    await saveSessionSummary(session);

    ws.send(JSON.stringify({
      type: 'session_stopped',
      sessionId,
      duration: Date.now() - session.startTime
    }));

    console.log(`🛑 Stopped session: ${sessionId}`);

  } catch (error) {
    console.error('❌ Failed to stop session:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to stop session'
    }));
  }
}

async function saveSessionSummary(session: StreamingSession) {
  try {
    const duration = (Date.now() - session.startTime) / 1000;
    
    // Calculate approximate cost based on session duration and type
    let cost = 0;
    if (session.type === 'transcription') {
      // Rough estimate: $0.006 per minute for streaming transcription
      cost = (duration / 60) * 0.006;
    } else if (session.type === 'llm') {
      // Rough estimate: varies by model, use conservative estimate
      cost = 0.001; // Base cost for streaming
    }

    await prisma.userUsage.create({
      data: {
        userId: session.userId,
        serviceType: session.type,
        provider: session.provider,
        model: session.provider, // Use provider as model for streaming
        inputTokens: session.type === 'transcription' ? null : 0,
        outputTokens: session.type === 'transcription' ? null : 0,
        audioSeconds: session.type === 'transcription' ? duration : null,
        durationSeconds: duration,
        inputCostUsd: null,
        outputCostUsd: null,
        totalCostUsd: cost,
        requestSize: null,
        quality: 'balanced',
        language: session.options.language || 'en',
        success: true,
        errorMessage: null
      }
    });

    console.log(`💾 Saved session summary: ${session.id}`);

  } catch (error) {
    console.error('❌ Failed to save session summary:', error);
  }
}