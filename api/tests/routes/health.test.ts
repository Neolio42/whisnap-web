import request from 'supertest';
import express from 'express';
import healthRoutes from '../../src/routes/health';
import { prismaMock } from '../setup';

describe('Health Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/health', healthRoutes);
  });

  describe('GET /health', () => {
    it('should return healthy status with all checks passing', async () => {
      // Mock successful database query
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.environment).toBe('test');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      
      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.memory).toHaveProperty('external');
      
      expect(response.body.database.status).toBe('connected');
      expect(response.body.database.latency).toMatch(/\d+ms/);
      
      expect(response.body.environment_check.status).toBe('ok');
      expect(response.body.environment_check.missing_vars).toHaveLength(0);
    });

    it('should return unhealthy status when database fails', async () => {
      // Mock database connection failure
      prismaMock.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Connection failed');
    });

    it('should detect missing environment variables', async () => {
      // Temporarily remove an environment variable
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.environment_check.status).toBe('warning');
      expect(response.body.environment_check.missing_vars).toContain('OPENAI_API_KEY');

      // Restore environment variable
      process.env.OPENAI_API_KEY = originalApiKey;
    });

    it('should measure database latency', async () => {
      prismaMock.$queryRaw.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([{ '?column?': 1 }]), 10))
      );

      const response = await request(app)
        .get('/health')
        .expect(200);

      const latencyMs = parseInt(response.body.database.latency.replace('ms', ''));
      expect(latencyMs).toBeGreaterThan(0);
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('providers');
      expect(response.body.checks).toHaveProperty('memory');

      // Database checks
      expect(response.body.checks.database.status).toBe('healthy');
      expect(response.body.checks.database.latency).toBeGreaterThanOrEqual(0);
      expect(response.body.checks.database.error).toBeNull();

      // Provider checks
      const providers = response.body.checks.providers;
      expect(providers.openai.configured).toBe(true);
      expect(providers.openai.status).toBe('healthy');
      expect(providers.anthropic.configured).toBe(true);
      expect(providers.anthropic.status).toBe('healthy');
      expect(providers.google.configured).toBe(true);
      expect(providers.google.status).toBe('healthy');

      // Memory checks
      expect(response.body.checks.memory.usage).toHaveProperty('heapUsed');
      expect(response.body.checks.memory.usage).toHaveProperty('heapTotal');
      expect(response.body.checks.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(response.body.checks.memory.percentage).toBeLessThanOrEqual(100);
    });

    it('should mark providers as not_configured when missing API keys', async () => {
      // Remove API keys
      const originalKeys = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      };
      
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.checks.providers.openai.configured).toBe(false);
      expect(response.body.checks.providers.openai.status).toBe('not_configured');
      expect(response.body.checks.providers.anthropic.configured).toBe(false);
      expect(response.body.checks.providers.anthropic.status).toBe('not_configured');

      // Restore keys
      Object.assign(process.env, originalKeys);
    });

    it('should return degraded status when database fails but providers are healthy', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.status).toBe('degraded');
      expect(response.body.checks.database.status).toBe('unhealthy');
      expect(response.body.checks.database.error).toBe('Database connection failed');
    });

    it('should return degraded status when no providers are configured', async () => {
      // Remove all API keys
      const originalKeys = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
        ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
        DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
        REV_AI_API_KEY: process.env.REV_AI_API_KEY
      };

      Object.keys(originalKeys).forEach(key => delete process.env[key]);

      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.status).toBe('degraded');
      
      Object.values(response.body.checks.providers).forEach((provider: any) => {
        expect(provider.configured).toBe(false);
        expect(provider.status).toBe('not_configured');
      });

      // Restore keys
      Object.assign(process.env, originalKeys);
    });

    it('should handle errors gracefully', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/health/detailed')
        .expect(500);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Detailed health check failed');
    });
  });
});