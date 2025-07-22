import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { JWTPayload } from '../../../shared/types';

// Lazy load JWT_SECRET to ensure env vars are loaded
const getJWTSecret = () => {
  return process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || '';
};

// JWKS client for NextAuth public key validation
const client = jwksClient({
  jwksUri: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/jwks`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('JWKS error:', err);
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
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

  // For development/testing, use simple HMAC validation
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    try {
      const secret = getJWTSecret();
      console.log('🔐 Auth Debug:', {
        environment: process.env.NODE_ENV,
        hasSecret: !!secret,
        secretLength: secret?.length,
        tokenLength: token?.length
      });
      
      const decoded = jwt.verify(token, secret) as any;
      console.log('✅ Token decoded successfully:', { userId: decoded.userId || decoded.sub, email: decoded.email });
      
      req.user = {
        userId: decoded.userId || decoded.sub,
        email: decoded.email,
        plan: decoded.plan || 'free',
        hasAccess: true
      } as JWTPayload;
      
      next();
      return;
    } catch (error) {
      console.error('❌ JWT Validation Error:', error);
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
  }

  // Production: Use JWKS validation
  jwt.verify(token, getKey, {
    audience: 'whisnap-api',
    issuer: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    algorithms: ['HS256', 'RS256']
  }, (err, decoded: any) => {
    if (err) {
      console.error('JWT validation error:', err);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    req.user = {
      userId: decoded.userId || decoded.sub,
      email: decoded.email,
      plan: decoded.plan || 'free',
      hasAccess: true
    } as JWTPayload;

    next();
  });
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

// Alias for backward compatibility
export const authenticateUser = authenticateToken;