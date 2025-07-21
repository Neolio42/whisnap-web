import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../../../shared/types';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET or NEXTAUTH_SECRET must be set');
}

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

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Check if token has required fields
    if (!decoded.userId || !decoded.email) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token payload',
        code: 'INVALID_TOKEN'
      });
    }

    // Attach user to request
    req.user = decoded;
    next();
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Token verification failed',
      code: 'AUTH_ERROR'
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
};