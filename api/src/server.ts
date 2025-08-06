// Load environment variables FIRST
import dotenv from 'dotenv';
import path from 'path';

const result = dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
}

// Debug environment variables
console.log('🔍 Server Debug:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? `${process.env.NEXTAUTH_SECRET.substring(0, 10)}...` : 'NOT_FOUND',
  JWT_SECRET: process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'NOT_FOUND',
  ENV_PATH: path.resolve(__dirname, '../.env')
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimitMiddleware } from './middleware/rateLimiter';

// Import routes
import transcriptionRoutes from './routes/transcription';
import llmRoutes from './routes/llm';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';

// Import WebSocket handler
import { setupWebSocket } from './websocket/streamingHandler';

const app = express();
const PORT = process.env.API_PORT || 4000;
const WS_PORT = typeof process.env.WS_PORT === 'string' ? parseInt(process.env.WS_PORT, 10) : 4001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',           // Next.js dev
    'https://whisnap.com',             // Production web
    'tauri://localhost',               // Desktop app
    'https://tauri.localhost'          // Desktop app alt
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom middleware
app.use(requestLogger);
app.use(rateLimitMiddleware);

// API Routes
app.use('/v1/health', healthRoutes);
app.use('/v1/transcribe', transcriptionRoutes);
app.use('/v1/llm', llmRoutes);
app.use('/v1/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Whisnap API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/v1/health',
      transcription: '/v1/transcribe',
      llm: '/v1/llm',
      analytics: '/v1/analytics',
      websocket: `ws://localhost:${WS_PORT}`
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ port: WS_PORT });
setupWebSocket(wss);

// Start servers
server.listen(PORT, () => {
  console.log(`🚀 Whisnap API Server running on port ${PORT}`);
  console.log(`📡 WebSocket Server running on port ${WS_PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 API Documentation: http://localhost:${PORT}`);
});

// WebSocket server info
console.log(`🔄 WebSocket endpoints:`);
console.log(`   - Streaming Transcription: ws://localhost:${WS_PORT}/transcribe`);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed');
    wss.close(() => {
      console.log('✅ WebSocket server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed');
    wss.close(() => {
      console.log('✅ WebSocket server closed');
      process.exit(0);
    });
  });
});

export default app;