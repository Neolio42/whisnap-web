import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
    availableEndpoints: {
      health: 'GET /v1/health',
      transcription: 'POST /v1/transcribe',
      streaming: 'WS /v1/transcribe/stream',
      llm: 'POST /v1/llm/chat',
      analytics: 'GET /v1/analytics/costs'
    }
  });
};