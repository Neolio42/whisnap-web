import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const JWT_SECRET = process.env.NEXTAUTH_SECRET || '';

export interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: NextRequest) => string | null;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  
  static async checkLimit(req: NextRequest, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    
    // Generate key for this request
    let key: string | null = null;
    
    if (config.keyGenerator) {
      key = config.keyGenerator(req);
    } else {
      // Default: use user ID from JWT token
      key = this.extractUserIdFromRequest(req);
    }
    
    if (!key) {
      // If no key, allow request (e.g., for public endpoints)
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs
      };
    }
    
    // Get current count for this key
    const record = rateLimitStore.get(key);
    const windowStart = now - config.windowMs;
    
    if (!record || record.resetTime < now) {
      // New window or expired record
      const newRecord = {
        count: 1,
        resetTime: now + config.windowMs
      };
      rateLimitStore.set(key, newRecord);
      
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime: newRecord.resetTime
      };
    }
    
    // Check if within limits
    const allowed = record.count < config.maxRequests;
    
    if (allowed) {
      record.count++;
      rateLimitStore.set(key, record);
    }
    
    return {
      allowed,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - record.count),
      resetTime: record.resetTime,
      retryAfter: allowed ? undefined : Math.ceil((record.resetTime - now) / 1000)
    };
  }
  
  private static extractUserIdFromRequest(req: NextRequest): string | null {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return null;
      }
      
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return decoded.userId || null;
    } catch {
      return null;
    }
  }
  
  static createUserRateLimit(maxRequests: number, windowMs: number): RateLimitConfig {
    return {
      maxRequests,
      windowMs,
      keyGenerator: (req) => this.extractUserIdFromRequest(req)
    };
  }
  
  static createIPRateLimit(maxRequests: number, windowMs: number): RateLimitConfig {
    return {
      maxRequests,
      windowMs,
      keyGenerator: (req) => {
        // Try to get real IP from headers (for proxies)
        return req.headers.get('x-forwarded-for')?.split(',')[0] ||
               req.headers.get('x-real-ip') ||
               req.ip ||
               'unknown';
      }
    };
  }
  
  static createGlobalRateLimit(maxRequests: number, windowMs: number): RateLimitConfig {
    return {
      maxRequests,
      windowMs,
      keyGenerator: () => 'global'
    };
  }
  
  // Cleanup expired entries (call periodically)
  static cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    rateLimitStore.forEach((record, key) => {
      if (record.resetTime < now) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => rateLimitStore.delete(key));
  }
}

// Predefined rate limit configs
export const RATE_LIMITS = {
  // Standard API calls
  API_DEFAULT: RateLimiter.createUserRateLimit(100, 15 * 60 * 1000), // 100 requests per 15 minutes
  
  // Expensive operations
  TRANSCRIPTION: RateLimiter.createUserRateLimit(20, 60 * 1000), // 20 transcriptions per minute
  LLM_REQUESTS: RateLimiter.createUserRateLimit(50, 60 * 1000),  // 50 LLM requests per minute
  
  // Authentication
  AUTH_LOGIN: RateLimiter.createIPRateLimit(5, 15 * 60 * 1000),    // 5 login attempts per 15 minutes per IP
  AUTH_DESKTOP: RateLimiter.createUserRateLimit(10, 60 * 1000),    // 10 desktop auth per minute
  
  // Admin/analytics
  ANALYTICS: RateLimiter.createUserRateLimit(30, 60 * 1000),       // 30 analytics requests per minute
  
  // Global limits (for abuse prevention)
  GLOBAL_TRANSCRIPTION: RateLimiter.createGlobalRateLimit(1000, 60 * 1000), // 1000 total transcriptions per minute
  GLOBAL_LLM: RateLimiter.createGlobalRateLimit(2000, 60 * 1000)            // 2000 total LLM requests per minute
};

// Middleware function for Next.js API routes
export function withRateLimit(config: RateLimitConfig) {
  return async function rateLimitMiddleware(req: NextRequest, handler: Function) {
    const result = await RateLimiter.checkLimit(req, config);
    
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime,
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': (result.retryAfter || 60).toString()
          }
        }
      );
    }
    
    // Add rate limit headers to successful responses
    const response = await handler(req);
    
    if (response instanceof Response) {
      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
    }
    
    return response;
  };
}

// Clean up expired entries every 5 minutes
setInterval(() => {
  RateLimiter.cleanup();
}, 5 * 60 * 1000);