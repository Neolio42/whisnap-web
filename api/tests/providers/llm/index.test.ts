import {
  selectLLMModel,
  getLLMProvider,
  modelSupportsStreaming,
  getAvailableModels,
  calculateCostComparison,
  getCheapestModel,
  getBestValueModel
} from '../../../src/providers/llm';

describe('LLM Provider Index', () => {
  describe('selectLLMModel', () => {
    it('should select fast models for fast quality', () => {
      const model = selectLLMModel({
        task: 'summary',
        quality: 'fast'
      });
      expect(model).toBe('gemini-1.5-flash');
    });

    it('should select accurate models for accurate quality', () => {
      const model = selectLLMModel({
        task: 'analysis',
        quality: 'accurate'
      });
      expect(model).toBe('claude-3-5-sonnet');
    });

    it('should consider budget constraints', () => {
      const model = selectLLMModel({
        task: 'analysis',
        budget: 'low'
      });
      expect(model).toBe('gemini-1.5-flash');
    });

    it('should consider high token output', () => {
      const model = selectLLMModel({
        task: 'creative',
        max_tokens: 5000,
        budget: 'low'
      });
      expect(model).toBe('gemini-1.5-flash');
    });

    it('should select appropriate models for different tasks', () => {
      expect(selectLLMModel({ task: 'creative' })).toBe('claude-3-5-sonnet');
      expect(selectLLMModel({ task: 'code' })).toBe('gpt-4o');
      expect(selectLLMModel({ task: 'summary' })).toBe('gpt-4o-mini');
    });
  });

  describe('getLLMProvider', () => {
    it('should return provider for valid models', () => {
      const provider = getLLMProvider('gpt-4o');
      expect(provider).toBeDefined();
      expect(provider.getAvailableModels()).toContain('gpt-4o');
    });

    it('should throw error for unknown models', () => {
      expect(() => getLLMProvider('unknown-model' as any)).toThrow('Unknown LLM model: unknown-model');
    });
  });

  describe('modelSupportsStreaming', () => {
    it('should return true for streaming-capable models', () => {
      expect(modelSupportsStreaming('gpt-4o')).toBe(true);
      expect(modelSupportsStreaming('claude-3-5-sonnet')).toBe(true);
      expect(modelSupportsStreaming('gemini-1.5-pro')).toBe(true);
    });
  });

  describe('getAvailableModels', () => {
    it('should return all available models with details', () => {
      const models = getAvailableModels();
      
      expect(models).toHaveLength(6);
      expect(models.map(m => m.name)).toContain('gpt-4o');
      expect(models.map(m => m.name)).toContain('claude-3-5-sonnet');
      expect(models.map(m => m.name)).toContain('gemini-1.5-flash');
      
      const gpt4o = models.find(m => m.name === 'gpt-4o');
      expect(gpt4o).toMatchObject({
        name: 'gpt-4o',
        provider: 'OpenAI',
        supportsStreaming: true,
        costPer1MTokens: { input: 2.50, output: 10.00 },
        strengths: ['coding', 'analysis', 'reasoning']
      });
    });
  });

  describe('calculateCostComparison', () => {
    it('should calculate and sort costs correctly', () => {
      const comparison = calculateCostComparison(1000, 500);
      
      expect(comparison).toHaveLength(6);
      expect(comparison[0].model).toBe('gemini-1.5-flash'); // Should be cheapest
      expect(comparison[comparison.length - 1].model).toBe('claude-3-5-sonnet'); // Should be most expensive
      
      // Verify costs are sorted ascending
      for (let i = 1; i < comparison.length; i++) {
        expect(comparison[i].cost).toBeGreaterThanOrEqual(comparison[i - 1].cost);
      }
      
      // Verify percentages
      expect(comparison[0].costPercentage).toBeLessThanOrEqual(100);
      expect(comparison[comparison.length - 1].costPercentage).toBe(100);
    });

    it('should handle zero tokens', () => {
      const comparison = calculateCostComparison(0, 0);
      expect(comparison).toHaveLength(6);
      comparison.forEach(item => {
        expect(item.cost).toBe(0);
        expect(item.costPercentage).toBe(0);
      });
    });
  });

  describe('getCheapestModel', () => {
    it('should return the cheapest model', () => {
      const cheapest = getCheapestModel(1000, 500);
      expect(cheapest).toBe('gemini-1.5-flash');
    });

    it('should be consistent with cost comparison', () => {
      const comparison = calculateCostComparison(1000, 500);
      const cheapest = getCheapestModel(1000, 500);
      expect(cheapest).toBe(comparison[0].model);
    });
  });

  describe('getBestValueModel', () => {
    it('should return appropriate models for different tasks', () => {
      expect(getBestValueModel('summary')).toBe('gpt-4o-mini');
      expect(getBestValueModel('analysis')).toBe('claude-3-5-sonnet');
      expect(getBestValueModel('creative')).toBe('claude-3-5-haiku');
      expect(getBestValueModel('code')).toBe('gpt-4o-mini');
    });

    it('should return second option from task models array', () => {
      // This tests the implementation detail that it returns the second option
      // which is typically the best balance of cost and capability
      const taskModels = {
        summary: ['claude-3-5-haiku', 'gpt-4o-mini', 'gemini-1.5-flash'],
        analysis: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
        creative: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'gpt-4o'],
        code: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet']
      };

      Object.entries(taskModels).forEach(([task, models]) => {
        const bestValue = getBestValueModel(task as any);
        expect(bestValue).toBe(models[1]);
      });
    });
  });
});