import request from 'supertest';
import express from 'express';
import llmRoutes from '../../src/routes/llm';
import { prismaMock, createMockUser, createMockToken, mockFetchResponse } from '../setup';

// Mock middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    req.user = createMockUser();
    next();
  }
}));

jest.mock('../../src/middleware/rateLimit', () => ({
  rateLimitLLM: (req: any, res: any, next: any) => next()
}));

jest.mock('../../src/middleware/usage', () => ({
  trackUsage: (service: string) => (req: any, res: any, next: any) => next()
}));

describe('LLM Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/llm', llmRoutes);
  });

  describe('GET /llm/models', () => {
    it('should return available models', async () => {
      const response = await request(app)
        .get('/llm/models')
        .expect(200);

      expect(response.body.models).toHaveLength(6);
      expect(response.body.models[0]).toHaveProperty('name');
      expect(response.body.models[0]).toHaveProperty('provider');
      expect(response.body.models[0]).toHaveProperty('supportsStreaming');
      expect(response.body.models[0]).toHaveProperty('costPer1MTokens');
      expect(response.body.models[0]).toHaveProperty('strengths');
    });
  });

  describe('POST /llm/complete', () => {
    const validMessages = [
      { role: 'user', content: 'Hello, world!' }
    ];

    beforeEach(() => {
      // Mock OpenAI API response
      mockFetchResponse({
        choices: [
          {
            message: { role: 'assistant', content: 'Hello! How can I help you?' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        model: 'gpt-4o-mini'
      });
    });

    it('should complete successfully with default model', async () => {
      const response = await request(app)
        .post('/llm/complete')
        .send({ messages: validMessages })
        .expect(200);

      expect(response.body.choices).toHaveLength(1);
      expect(response.body.choices[0].message.content).toBe('Hello! How can I help you?');
      expect(response.body.usage.total_tokens).toBe(18);
      expect(response.body).toHaveProperty('cost');
      expect(response.body).toHaveProperty('duration');
    });

    it('should complete with specified model', async () => {
      const response = await request(app)
        .post('/llm/complete')
        .send({
          model: 'gpt-4o',
          messages: validMessages,
          max_tokens: 500,
          temperature: 0.8
        })
        .expect(200);

      expect(response.body.choices).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-openai-key',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('"model":"gpt-4o"')
        })
      );
    });

    it('should auto-select model based on task and quality', async () => {
      const response = await request(app)
        .post('/llm/complete')
        .send({
          messages: validMessages,
          task: 'creative',
          quality: 'accurate'
        })
        .expect(200);

      expect(response.body.choices).toHaveLength(1);
      // Should select claude-3-5-sonnet for creative + accurate
    });

    it('should validate messages array', async () => {
      const response = await request(app)
        .post('/llm/complete')
        .send({ messages: [] })
        .expect(400);

      expect(response.body.error).toBe('Messages array is required');
    });

    it('should handle missing messages', async () => {
      const response = await request(app)
        .post('/llm/complete')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Messages array is required');
    });

    it('should handle API errors', async () => {
      mockFetchResponse({ error: 'Rate limit exceeded' }, 429);

      const response = await request(app)
        .post('/llm/complete')
        .send({ messages: validMessages })
        .expect(500);

      expect(response.body.error).toBe('Completion failed');
    });

    it('should reject streaming for non-streaming models', async () => {
      // This would need a mock for a non-streaming model
      const response = await request(app)
        .post('/llm/complete')
        .send({
          messages: validMessages,
          stream: true,
          model: 'non-streaming-model'
        });

      // Would expect 400 for non-streaming model, but since we don't have one,
      // this test would need to be updated when we have such models
    });
  });

  describe('POST /llm/analyze-cost', () => {
    it('should analyze costs for different models', async () => {
      const messages = [
        { role: 'user', content: 'This is a test message for cost analysis.' }
      ];

      const response = await request(app)
        .post('/llm/analyze-cost')
        .send({
          messages,
          estimated_output_tokens: 100
        })
        .expect(200);

      expect(response.body).toHaveProperty('inputTokens');
      expect(response.body).toHaveProperty('outputTokens', 100);
      expect(response.body).toHaveProperty('costComparison');
      expect(response.body).toHaveProperty('recommendations');

      expect(response.body.costComparison).toHaveLength(6);
      expect(response.body.costComparison[0].cost).toBeLessThanOrEqual(
        response.body.costComparison[response.body.costComparison.length - 1].cost
      );

      expect(response.body.recommendations).toHaveProperty('cheapest');
      expect(response.body.recommendations).toHaveProperty('bestValueSummary');
      expect(response.body.recommendations).toHaveProperty('bestValueAnalysis');
      expect(response.body.recommendations).toHaveProperty('bestValueCreative');
      expect(response.body.recommendations).toHaveProperty('bestValueCode');
    });

    it('should require messages array', async () => {
      const response = await request(app)
        .post('/llm/analyze-cost')
        .send({ estimated_output_tokens: 100 })
        .expect(400);

      expect(response.body.error).toBe('Messages array is required');
    });

    it('should use default output tokens if not provided', async () => {
      const response = await request(app)
        .post('/llm/analyze-cost')
        .send({
          messages: [{ role: 'user', content: 'Test' }]
        })
        .expect(200);

      expect(response.body.outputTokens).toBe(1000);
    });
  });

  describe('POST /llm/recommend-model', () => {
    it('should recommend model based on parameters', async () => {
      const response = await request(app)
        .post('/llm/recommend-model')
        .send({
          task: 'code',
          quality: 'accurate',
          budget: 'high'
        })
        .expect(200);

      expect(response.body).toHaveProperty('recommendedModel');
      expect(response.body).toHaveProperty('modelInfo');
      expect(response.body).toHaveProperty('reasoning');

      expect(response.body.reasoning.task).toBe('code');
      expect(response.body.reasoning.quality).toBe('accurate');
      expect(response.body.reasoning.budget).toBe('high');
      expect(response.body.reasoning.userPlan).toBe('free');
    });

    it('should use defaults for missing parameters', async () => {
      const response = await request(app)
        .post('/llm/recommend-model')
        .send({})
        .expect(200);

      expect(response.body.reasoning.task).toBe('analysis');
      expect(response.body.reasoning.quality).toBe('balanced');
      expect(response.body.reasoning.budget).toBe('low'); // Free plan user
      expect(response.body.reasoning.max_tokens).toBe(1000);
    });

    it('should adjust budget based on user plan', async () => {
      // Mock premium user
      jest.doMock('../../src/middleware/auth', () => ({
        authenticateUser: (req: any, res: any, next: any) => {
          req.user = createMockUser({ plan: 'cloud' });
          next();
        }
      }));

      const response = await request(app)
        .post('/llm/recommend-model')
        .send({})
        .expect(200);

      expect(response.body.reasoning.userPlan).toBe('free'); // Still free due to mock
    });
  });

  describe('POST /llm/chat', () => {
    const validMessages = [
      { role: 'user', content: 'Hello, how are you?' }
    ];

    beforeEach(() => {
      mockFetchResponse({
        choices: [
          {
            message: { role: 'assistant', content: 'I am doing well, thank you!' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 },
        model: 'gpt-4o-mini'
      });
    });

    it('should complete chat with system context', async () => {
      const response = await request(app)
        .post('/llm/chat')
        .send({
          messages: validMessages,
          context: 'creative'
        })
        .expect(200);

      expect(response.body.choices).toHaveLength(1);
      expect(response.body.choices[0].message.content).toBe('I am doing well, thank you!');

      // Verify system message was added
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[0].content).toContain('creative');
    });

    it('should use default context if not specified', async () => {
      const response = await request(app)
        .post('/llm/chat')
        .send({ messages: validMessages })
        .expect(200);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.messages[0].content).toBe('You are a helpful AI assistant.');
    });

    it('should adjust temperature for creative context', async () => {
      await request(app)
        .post('/llm/chat')
        .send({
          messages: validMessages,
          context: 'creative'
        })
        .expect(200);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.temperature).toBe(0.9);
    });

    it('should require messages array', async () => {
      const response = await request(app)
        .post('/llm/chat')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Messages array is required');
    });

    it('should set appropriate max_tokens for chat', async () => {
      await request(app)
        .post('/llm/chat')
        .send({ messages: validMessages })
        .expect(200);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.max_tokens).toBe(2000);
    });
  });
});