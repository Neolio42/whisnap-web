import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '@shared/types';

// Lazy load JWT_SECRET to ensure env vars are loaded
const getJWTSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or JWT_SECRET must be set');
  }
  if (secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters');
  }
  return secret;
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.substring(7);

  // Use simple HMAC validation (works for all environments)
  try {
    const secret = getJWTSecret();
    
    const decoded = jwt.verify(token, secret, { 
      algorithms: ['HS256'],
      audience: 'whisnap-api'
    }) as any;
    
    // Validate required fields
    if (!decoded.userId && !decoded.sub) {
      throw new Error('Missing user ID in token');
    }
    
    req.user = {
      userId: decoded.userId || decoded.sub,
      email: decoded.email,
      plan: decoded.plan || 'free',
      hasAccess: decoded.hasAccess ?? true
    } as JWTPayload;
    
    next();
    return;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

export const requirePlan = (allowedPlans: Array<'free' | 'byok' | 'cloud'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedPlans.includes(req.user.plan)) {
      return res.status(403).json({
        success: false,
        error: `This feature requires ${allowedPlans.join(' or ')} plan`,
        code: 'INSUFFICIENT_PLAN'
      });
    }

    next();
    return;
  };
};

export const requireAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  if (!req.user.hasAccess) {
    return res.status(403).json({
      success: false,
      error: 'Account access required',
      code: 'ACCESS_DENIED'
    });
  }

  next();
  return;
};

// Alias for backward compatibility
export const authenticateUser = authenticateToken;