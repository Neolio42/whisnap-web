import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { rateLimitLLM } from '../middleware/rateLimit';
import { trackUsage } from '../middleware/usage';
import { LLMModel, LLMMessage, LLMResult } from '../shared/types/index';
import { 
  getLLMProvider, 
  selectLLMModel, 
  getAvailableModels,
  calculateCostComparison,
  getCheapestModel,
  getBestValueModel,
  modelSupportsStreaming
} from '../providers/llm';

const router = express.Router();

// GET /llm/models - List available models
router.get('/models', authenticateUser, async (req, res) => {
  try {
    const models = getAvailableModels();
    return res.json({ models });
  } catch (error) {
    console.error('Failed to list LLM models:', error);
    return res.status(500).json({ 
      error: 'Failed to list models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /llm/complete - Generate completion
router.post('/complete',
  authenticateUser,
  rateLimitLLM,
  trackUsage('llm'),
  async (req, res) => {
    try {
      const { 
        model, 
        messages, 
        max_tokens = 1000, 
        temperature = 0.7, 
        stream = false,
        task,
        quality,
        budget
      } = req.body;
      const userId = (req.user as any).id;

      // Validate messages
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      // Auto-select model if not specified
      const selectedModel = model || selectLLMModel({
        task: task || 'analysis',
        quality: quality || 'balanced',
        max_tokens,
        budget: budget || (req.user!.plan === 'free' ? 'low' : 'medium')
      });

      // Check if streaming is requested but not supported
      if (stream && !modelSupportsStreaming(selectedModel)) {
        return res.status(400).json({ 
          error: 'Streaming not supported for this model',
          model: selectedModel
        });
      }

      const provider = getLLMProvider(selectedModel);

      const options = {
        model: selectedModel,
        messages: messages as LLMMessage[],
        max_tokens,
        temperature,
        stream,
        userId
      };

      const startTime = Date.now();

      if (stream) {
        // Set up SSE headers for streaming
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        let fullContent = '';
        let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        const streamOptions = {
          ...options,
          onStreamChunk: (chunk: string) => {
            fullContent += chunk;
            res.write(`data: ${JSON.stringify({ 
              type: 'chunk', 
              content: chunk,
              model: selectedModel
            })}\n\n`);
          },
          onStreamComplete: (result: LLMResult) => {
            usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
            const duration = (Date.now() - startTime) / 1000;
            const cost = provider.calculateCost(selectedModel, usage.prompt_tokens, usage.completion_tokens);

            res.write(`data: ${JSON.stringify({ 
              type: 'complete',
              result: {
                ...result,
                duration,
                cost: cost.toFixed(6)
              }
            })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
        };

        await provider.streamComplete?.(streamOptions);
        return;

      } else {
        // Regular completion
        const result = await provider.complete(options);
        const duration = (Date.now() - startTime) / 1000;
        const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        const cost = provider.calculateCost(selectedModel, usage.prompt_tokens, usage.completion_tokens);

        const response: LLMResult = {
          ...result,
          duration,
          cost: cost.toFixed(6)
        };

        return res.json(response);
      }

    } catch (error) {
      console.error('LLM completion failed:', error);
      
      if (res.headersSent) {
        // If streaming, send error via SSE
        res.write(`data: ${JSON.stringify({ 
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })}\n\n`);
        res.end();
        return;
      } else {
        return res.status(500).json({ 
          error: 'Completion failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
);

// POST /llm/analyze-cost - Analyze cost for different models
router.post('/analyze-cost',
  authenticateUser,
  async (req, res) => {
    try {
      const { messages, estimated_output_tokens = 1000 } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      // Estimate input tokens
      const totalText = messages.map((m: LLMMessage) => m.content).join(' ');
      const inputTokens = Math.ceil(totalText.length / 4); // Rough estimate

      const costComparison = calculateCostComparison(inputTokens, estimated_output_tokens);
      const cheapestModel = getCheapestModel(inputTokens, estimated_output_tokens);

      return res.json({
        inputTokens,
        outputTokens: estimated_output_tokens,
        costComparison,
        recommendations: {
          cheapest: cheapestModel,
          bestValueSummary: getBestValueModel('summary'),
          bestValueAnalysis: getBestValueModel('analysis'),
          bestValueCreative: getBestValueModel('creative'),
          bestValueCode: getBestValueModel('code')
        }
      });

    } catch (error) {
      console.error('Cost analysis failed:', error);
      return res.status(500).json({ 
        error: 'Cost analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /llm/recommend-model - Get model recommendation
router.post('/recommend-model',
  authenticateUser,
  async (req, res) => {
    try {
      const { 
        task = 'analysis', 
        quality = 'balanced', 
        max_tokens = 1000,
        budget = 'medium'
      } = req.body;

      const recommendedModel = selectLLMModel({
        task,
        quality,
        max_tokens,
        budget: budget || (req.user!.plan === 'free' ? 'low' : 'medium')
      });

      const modelInfo = getAvailableModels().find(m => m.name === recommendedModel);

      return res.json({
        recommendedModel,
        modelInfo,
        reasoning: {
          task,
          quality,
          max_tokens,
          budget,
          userPlan: req.user!.plan
        }
      });

    } catch (error) {
      console.error('Model recommendation failed:', error);
      return res.status(500).json({ 
        error: 'Model recommendation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /llm/chat - Chat completion with conversation context
router.post('/chat',
  authenticateUser,
  rateLimitLLM,
  trackUsage('llm'),
  async (req, res) => {
    try {
      const { 
        messages, 
        model, 
        stream = false,
        context = 'general'
      } = req.body;
      const userId = (req.user as any).id;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      // Add system context based on conversation type
      const systemPrompts = {
        general: 'You are a helpful AI assistant.',
        transcription: 'You are helping to analyze and improve transcribed text. Focus on clarity, accuracy, and useful insights.',
        analysis: 'You are an AI assistant specialized in detailed analysis and research. Provide thorough, well-structured responses.',
        creative: 'You are a creative AI assistant. Be imaginative, engaging, and help with creative tasks.',
        code: 'You are a coding assistant. Provide clean, well-documented code with explanations.'
      };

      const enhancedMessages = [
        { role: 'system', content: systemPrompts[context as keyof typeof systemPrompts] || systemPrompts.general },
        ...messages
      ];

      // Select appropriate model for chat
      const selectedModel = model || selectLLMModel({
        task: context === 'code' ? 'code' : 'analysis',
        quality: 'balanced',
        budget: req.user!.plan === 'free' ? 'low' : 'medium'
      });

      const provider = getLLMProvider(selectedModel);

      const options = {
        model: selectedModel,
        messages: enhancedMessages,
        max_tokens: 2000,
        temperature: context === 'creative' ? 0.9 : 0.7,
        stream,
        userId
      };

      const startTime = Date.now();

      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        const streamOptions = {
          ...options,
          onStreamChunk: (chunk: string) => {
            res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          },
          onStreamComplete: (result: LLMResult) => {
            const duration = (Date.now() - startTime) / 1000;
            const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
            const cost = provider.calculateCost(selectedModel, usage.prompt_tokens, usage.completion_tokens);
            
            res.write(`data: ${JSON.stringify({ 
              type: 'complete',
              usage: result.usage,
              duration,
              cost: cost.toFixed(6)
            })}\n\n`);
            res.end();
          }
        };

        await provider.streamComplete?.(streamOptions);
        return;

      } else {
        const result = await provider.complete(options);
        const duration = (Date.now() - startTime) / 1000;
        const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        const cost = provider.calculateCost(selectedModel, usage.prompt_tokens, usage.completion_tokens);

        return res.json({
          ...result,
          duration,
          cost: cost.toFixed(6)
        });
      }

    } catch (error) {
      console.error('Chat completion failed:', error);
      return res.status(500).json({ 
        error: 'Chat completion failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;