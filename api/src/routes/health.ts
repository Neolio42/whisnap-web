import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /health - Basic health check
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_AI_API_KEY'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      database: {
        status: 'connected',
        latency: `${dbLatency}ms`
      },
      environment_check: {
        status: missingEnvVars.length === 0 ? 'ok' : 'warning',
        missing_vars: missingEnvVars
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /health/detailed - Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const checks = {
      database: { status: 'unknown' as string, latency: 0, error: null as string | null },
      providers: {
        openai: { status: 'unknown', configured: false },
        anthropic: { status: 'unknown', configured: false },
        google: { status: 'unknown', configured: false },
        assemblyai: { status: 'unknown', configured: false },
        deepgram: { status: 'unknown', configured: false },
        rev: { status: 'unknown', configured: false }
      },
      memory: {
        usage: process.memoryUsage(),
        percentage: 0
      },
      disk: {
        free: 0,
        total: 0
      }
    };

    // Database check
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
        error: null
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Provider configuration checks
    checks.providers.openai.configured = !!process.env.OPENAI_API_KEY;
    checks.providers.anthropic.configured = !!process.env.ANTHROPIC_API_KEY;
    checks.providers.google.configured = !!process.env.GOOGLE_AI_API_KEY;
    checks.providers.assemblyai.configured = !!process.env.ASSEMBLYAI_API_KEY;
    checks.providers.deepgram.configured = !!process.env.DEEPGRAM_API_KEY;
    checks.providers.rev.configured = !!process.env.REV_AI_API_KEY;

    // Mark configured providers as healthy (basic check)
    Object.keys(checks.providers).forEach(provider => {
      checks.providers[provider as keyof typeof checks.providers].status = 
        checks.providers[provider as keyof typeof checks.providers].configured ? 'healthy' : 'not_configured';
    });

    // Memory check
    const memUsage = process.memoryUsage();
    checks.memory.usage = memUsage;
    checks.memory.percentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    const overallStatus = 
      checks.database.status === 'healthy' && 
      Object.values(checks.providers).some(p => p.status === 'healthy')
        ? 'healthy' 
        : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    });

  } catch (error) {
    console.error('Detailed health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;