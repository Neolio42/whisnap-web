import { Request, Response, NextFunction } from 'express';
import { APIError } from '../shared/types';
import { logger } from '../utils/logger';

export const errorHandler = (
  error: Error | APIError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error details
  logger.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if ('statusCode' in error && error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code || 'API_ERROR',
      ...(error.retryAfter && { retryAfter: error.retryAfter })
    });
  }

  // Handle JWT errors (shouldn't reach here, but just in case)
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // Handle multer errors (file upload)
  if (error.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: 'File upload error: ' + error.message,
      code: 'UPLOAD_ERROR'
    });
  }

  // Handle rate limit errors
  if (error.message.includes('rate limit')) {
    return res.status(429).json({
      success: false,
      error: error.message,
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  // Handle database errors
  if (error.name === 'PrismaClientKnownRequestError' || 
      error.name === 'PrismaClientUnknownRequestError') {
    return res.status(500).json({
      success: false,
      error: 'Database error occurred',
      code: 'DATABASE_ERROR'
    });
  }

  // Handle network/provider errors
  if (error.message.includes('ECONNREFUSED') || 
      error.message.includes('timeout') ||
      error.message.includes('network')) {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      retryAfter: 60
    });
  }

  // Generic server error
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};