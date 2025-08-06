import express from 'express';
import multer from 'multer';
import { authenticateUser } from '../middleware/auth';
import { rateLimitTranscription } from '../middleware/rateLimit';
import { trackUsage } from '../middleware/usage';
import { TranscriptionProvider, TranscriptionResult } from '../../../shared/types';
import { 
  getTranscriptionProvider, 
  selectTranscriptionProvider,
  TRANSCRIPTION_PROVIDERS 
} from '../providers/transcription';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav',
      'audio/webm', 'audio/ogg', 'audio/flac', 'audio/m4a',
      'video/mp4', 'video/webm', 'video/quicktime'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported formats: MP3, MP4, WAV, WEBM, OGG, FLAC, M4A, MOV'));
    }
  }
});

// GET /transcription/providers - List available providers
router.get('/providers', authenticateUser, async (req, res) => {
  try {
    const providers = Object.keys(TRANSCRIPTION_PROVIDERS).map(name => {
      const provider = TRANSCRIPTION_PROVIDERS[name as TranscriptionProvider]();
      return {
        name: name as TranscriptionProvider,
        supportsStreaming: provider.supportsStreaming(),
        supportedFormats: provider.getSupportedFormats?.() || [],
        maxFileSize: provider.getMaxFileSize?.() || 25 * 1024 * 1024,
        features: provider.getFeatures?.() || ['transcription']
      };
    });

    res.json({ providers });
    return;
  } catch (error) {
    console.error('Failed to list transcription providers:', error);
    res.status(500).json({ 
      error: 'Failed to list providers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// POST /transcription/transcribe - Transcribe audio file
router.post('/transcribe', 
  authenticateUser,
  rateLimitTranscription,
  upload.single('audio'),
  trackUsage('transcription'),
  async (req, res) => {
    try {
      const { provider, language, task = 'transcribe', format = 'text' } = req.body;
      const file = req.file;
      const userId = req.user!.userId;

      console.log('📁 File Upload Debug:', {
        hasFile: !!file,
        fileName: file?.originalname,
        fileSize: file?.size,
        mimeType: file?.mimetype,
        bufferSize: file?.buffer?.length
      });

      if (!file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({ error: 'Audio buffer is empty' });
      }

      // Auto-select provider if not specified
      const selectedProvider = provider || selectTranscriptionProvider({
        streaming: false,
        duration: 0, // Will be detected by provider
        quality: 'balanced',
        language: language || 'en'
      });

      const transcriptionProvider = getTranscriptionProvider(selectedProvider);

      const options = {
        audio: file.buffer,
        language,
        userId
      };

      const startTime = Date.now();
      const result = await transcriptionProvider.transcribe(options);
      const duration = Date.now() - startTime;

      // Calculate cost
      const cost = transcriptionProvider.calculateCost(selectedProvider, file.size / (1024 * 1024), duration / 1000);

      const response: TranscriptionResult = {
        text: result.text,
        provider: selectedProvider,
        duration: duration / 1000,
        cost: cost.toFixed(6),
        metadata: result.metadata
      };

      res.json(response);
      return;

    } catch (error) {
      console.error('Transcription failed:', error);
      res.status(500).json({ 
        error: 'Transcription failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return;
    }
  }
);

// POST /transcription/stream - Start streaming transcription
router.post('/stream/start',
  authenticateUser,
  rateLimitTranscription,
  trackUsage('transcription'),
  async (req, res) => {
    try {
      const { provider = 'assemblyai', language, sampleRate = 16000 } = req.body;
      const userId = req.user!.userId;

      const transcriptionProvider = getTranscriptionProvider(provider);

      if (!transcriptionProvider.supportsStreaming()) {
        return res.status(400).json({ 
          error: 'Provider does not support streaming',
          suggestion: 'Use assemblyai or deepgram for streaming transcription'
        });
      }

      // Generate session ID for this streaming session
      const sessionId = `stream_${userId}_${Date.now()}`;

      const options = {
        language,
        sampleRate,
        userId,
        sessionId,
        onTranscript: (transcript: any) => {
          // This will be handled via WebSocket
          console.log('Received transcript:', transcript);
        },
        onError: (error: Error) => {
          console.error('Streaming error:', error);
        }
      };

      // Start streaming session (this would typically connect to WebSocket)
      const streamInfo = await transcriptionProvider.startStreaming?.(options);

      res.json({
        sessionId,
        provider,
        status: 'ready',
        websocketUrl: `ws://localhost:4001/transcription/${sessionId}`,
        streamInfo
      });
      return;

    } catch (error) {
      console.error('Failed to start streaming:', error);
      res.status(500).json({ 
        error: 'Failed to start streaming',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return;
    }
  }
);

// GET /transcription/stream/:sessionId/status - Check streaming status
router.get('/stream/:sessionId/status',
  authenticateUser,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Verify session belongs to user
      if (!sessionId.includes(userId)) {
        return res.status(403).json({ error: 'Access denied to this session' });
      }

      // In a real implementation, you'd check the streaming session status
      // For now, return a mock status
      const sessionParts = sessionId.split('_');
      const timestampStr = sessionParts[2];
      const timestamp = timestampStr ? parseInt(timestampStr) || Date.now() : Date.now();
      
      res.json({
        sessionId,
        status: 'active',
        duration: Date.now() - timestamp,
        transcriptCount: 0 // Would be tracked in real implementation
      });
      return;

    } catch (error) {
      console.error('Failed to get stream status:', error);
      res.status(500).json({ 
        error: 'Failed to get stream status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return;
    }
  }
);

// POST /transcription/stream/:sessionId/stop - Stop streaming transcription
router.post('/stream/:sessionId/stop',
  authenticateUser,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Verify session belongs to user
      if (!sessionId.includes(userId)) {
        return res.status(403).json({ error: 'Access denied to this session' });
      }

      // Stop the streaming session
      // In a real implementation, you'd:
      // 1. Close WebSocket connection
      // 2. Stop provider streaming
      // 3. Calculate final cost
      // 4. Save session summary

      res.json({
        sessionId,
        status: 'stopped',
        finalTranscript: '', // Would contain final transcript
        totalDuration: 0,
        totalCost: '0.00'
      });
      return;

    } catch (error) {
      console.error('Failed to stop streaming:', error);
      res.status(500).json({ 
        error: 'Failed to stop streaming',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return;
    }
  }
);

export default router;