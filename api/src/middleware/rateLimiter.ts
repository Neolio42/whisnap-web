import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Store for tracking requests (use Redis in production)
const requestStore = new Map<string, { count: number; resetTime: number }>();

// Custom key generator that uses JWT user ID
const keyGenerator = (req: Request): string => {
  if (req.user?.userId) {
    return `user:${req.user.userId}`;
  }
  // Fallback to IP
  return req.ip || req.connection.remoteAddress || 'unknown';
};

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  keyGenerator,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Transcription rate limiting (more restrictive)
export const transcriptionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 transcription requests per minute
  keyGenerator,
  message: {
    success: false,
    error: 'Too many transcription requests, please slow down',
    code: 'TRANSCRIPTION_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// LLM rate limiting
export const llmRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 LLM requests per minute
  keyGenerator,
  message: {
    success: false,
    error: 'Too many LLM requests, please slow down',
    code: 'LLM_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Analytics rate limiting (lighter)
export const analyticsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 analytics requests per minute
  keyGenerator,
  message: {
    success: false,
    error: 'Too many analytics requests, please slow down',
    code: 'ANALYTICS_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Slow down middleware (progressive delays)
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 500, // Start slowing down after 500 requests
  delayMs: () => 500, // Add 500ms delay per request (new v2 format)
  maxDelayMs: 20000, // Max 20 second delay
  keyGenerator
});

// Global rate limiting for all endpoints
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10000, // 10k total requests per minute across all users
  keyGenerator: () => 'global',
  message: {
    success: false,
    error: 'Service temporarily overloaded, please try again later',
    code: 'GLOBAL_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter middleware that applies appropriate limits
export const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Apply global rate limit first
  globalRateLimit(req, res, (err) => {
    if (err) return next(err);
    
    // Then apply general rate limit
    generalRateLimit(req, res, (err) => {
      if (err) return next(err);
      
      // Apply speed limiter for high usage
      speedLimiter(req, res, next);
    });
  });
};

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestStore.entries()) {
    if (record.resetTime < now) {
      requestStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes