import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Real usage tracking middleware that saves to database
export const trackUsage = (service: 'transcription' | 'llm' | 'analytics') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    const startTime = Date.now();
    
    // Override res.json to capture response data
    res.json = function(data: any) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      
      // Track usage asynchronously (don't block response)
      setImmediate(async () => {
        try {
          const success = !data.error && res.statusCode < 400;
          const userId = req.user?.userId;
          
          if (userId) {
            // Create usage record AND increment user's usage count
            await prisma.$transaction([
              prisma.userUsage.create({
                data: {
                  userId: userId,
                  serviceType: service,
                  provider: data.provider || 'unknown',
                  model: data.model || 'unknown',
                  durationSeconds: duration,
                  totalCostUsd: parseFloat(data.cost || '0'),
                  success: success,
                  errorMessage: data.error || null,
                  // Add specific fields based on service type
                  ...(service === 'transcription' && {
                    audioSeconds: data.duration || 0,
                  }),
                  ...(service === 'llm' && {
                    inputTokens: data.usage?.prompt_tokens || 0,
                    outputTokens: data.usage?.completion_tokens || 0,
                  }),
                  requestSize: req.headers['content-length'] ? parseInt(req.headers['content-length']) : null,
                  quality: req.body?.quality || null,
                  language: req.body?.language || null
                }
              }),
              // Increment user's usage count
              prisma.user.update({
                where: { id: userId },
                data: {
                  usageCount: { increment: 1 }
                }
              })
            ]);
            
            console.log(`✅ Usage tracked: ${service} for user ${userId} - $${data.cost || '0'}`);
          }
        } catch (error) {
          console.error('Failed to track usage:', error);
        }
      });
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};