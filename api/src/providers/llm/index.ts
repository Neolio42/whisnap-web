import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { BaseLLMProvider } from './base';
import { LLMModel } from '../../../../shared/types';

// Provider registry with lazy initialization
const llmInstances: Partial<Record<LLMModel, BaseLLMProvider>> = {};

export const LLM_PROVIDERS = {
  'gpt-4o': () => llmInstances['gpt-4o'] || (llmInstances['gpt-4o'] = new OpenAIProvider()),
  'gpt-4o-mini': () => llmInstances['gpt-4o-mini'] || (llmInstances['gpt-4o-mini'] = new OpenAIProvider()),
  'claude-3-5-sonnet': () => llmInstances['claude-3-5-sonnet'] || (llmInstances['claude-3-5-sonnet'] = new AnthropicProvider()),
  'claude-3-5-haiku': () => llmInstances['claude-3-5-haiku'] || (llmInstances['claude-3-5-haiku'] = new AnthropicProvider()),
  'gemini-1.5-pro': () => llmInstances['gemini-1.5-pro'] || (llmInstances['gemini-1.5-pro'] = new GeminiProvider()),
  'gemini-1.5-flash': () => llmInstances['gemini-1.5-flash'] || (llmInstances['gemini-1.5-flash'] = new GeminiProvider())
};

// Smart model selection logic
export function selectLLMModel(params: {
  task: 'summary' | 'analysis' | 'creative' | 'code';
  quality?: 'fast' | 'balanced' | 'accurate';
  max_tokens?: number;
  budget?: 'low' | 'medium' | 'high';
}): LLMModel {
  const { task, quality = 'balanced', max_tokens = 1000, budget = 'medium' } = params;

  // For high token output, prefer cheaper models
  if (max_tokens > 4000) {
    if (budget === 'low') return 'gemini-1.5-flash';
    if (quality === 'accurate') return 'claude-3-5-sonnet';
    return 'gpt-4o-mini';
  }

  // Task-specific routing with quality consideration
  switch (task) {
    case 'summary':
      if (quality === 'fast') return 'gemini-1.5-flash';
      if (quality === 'accurate') return 'claude-3-5-haiku';
      return budget === 'low' ? 'gemini-1.5-flash' : 'gpt-4o-mini';
      
    case 'analysis':
      if (quality === 'fast') return 'gpt-4o-mini';
      if (quality === 'accurate') return 'claude-3-5-sonnet';
      return budget === 'low' ? 'gemini-1.5-flash' : 'gpt-4o';
      
    case 'creative':
      if (quality === 'fast') return 'claude-3-5-haiku';
      return 'claude-3-5-sonnet'; // Claude excels at creative tasks
      
    case 'code':
      if (quality === 'fast') return 'gpt-4o-mini';
      if (budget === 'low') return 'gemini-1.5-flash';
      return 'gpt-4o'; // GPT-4 excels at coding
      
    default:
      // Default to most cost-effective option
      return budget === 'low' ? 'gemini-1.5-flash' : 'gpt-4o-mini';
  }
}

// Get provider instance
export function getLLMProvider(model: LLMModel): BaseLLMProvider {
  const providerFactory = LLM_PROVIDERS[model];
  if (!providerFactory) {
    throw new Error(`Unknown LLM model: ${model}`);
  }
  return providerFactory();
}

// Check if model supports streaming
export function modelSupportsStreaming(model: LLMModel): boolean {
  return getLLMProvider(model).supportsStreaming();
}

// Get all available models with details
export function getAvailableModels(): Array<{
  name: LLMModel;
  provider: string;
  supportsStreaming: boolean;
  costPer1MTokens: { input: number; output: number };
  strengths: string[];
}> {
  return [
    {
      name: 'gpt-4o',
      provider: 'OpenAI',
      supportsStreaming: true,
      costPer1MTokens: { input: 2.50, output: 10.00 },
      strengths: ['coding', 'analysis', 'reasoning']
    },
    {
      name: 'gpt-4o-mini',
      provider: 'OpenAI',
      supportsStreaming: true,
      costPer1MTokens: { input: 0.15, output: 0.60 },
      strengths: ['cost-effective', 'fast', 'general-purpose']
    },
    {
      name: 'claude-3-5-sonnet',
      provider: 'Anthropic',
      supportsStreaming: true,
      costPer1MTokens: { input: 3.00, output: 15.00 },
      strengths: ['creative', 'analysis', 'long-context']
    },
    {
      name: 'claude-3-5-haiku',
      provider: 'Anthropic',
      supportsStreaming: true,
      costPer1MTokens: { input: 0.25, output: 1.25 },
      strengths: ['fast', 'cost-effective', 'summarization']
    },
    {
      name: 'gemini-1.5-pro',
      provider: 'Google',
      supportsStreaming: true,
      costPer1MTokens: { input: 1.25, output: 5.00 },
      strengths: ['multimodal', 'reasoning', 'analysis']
    },
    {
      name: 'gemini-1.5-flash',
      provider: 'Google',
      supportsStreaming: true,
      costPer1MTokens: { input: 0.075, output: 0.30 },
      strengths: ['ultra-fast', 'cheapest', 'high-throughput']
    }
  ];
}

// Calculate cost comparison for a given request
export function calculateCostComparison(inputTokens: number, outputTokens: number): Array<{
  model: LLMModel;
  cost: number;
  costPercentage: number;
}> {
  const costs = Object.entries(LLM_PROVIDERS).map(([model, providerFactory]) => ({
    model: model as LLMModel,
    cost: providerFactory().calculateCost(model as LLMModel, inputTokens, outputTokens)
  }));
  
  const maxCost = Math.max(...costs.map(c => c.cost));
  
  return costs
    .map(c => ({
      ...c,
      costPercentage: maxCost > 0 ? (c.cost / maxCost) * 100 : 0
    }))
    .sort((a, b) => a.cost - b.cost);
}

// Get cheapest model for a given token count
export function getCheapestModel(inputTokens: number, outputTokens: number): LLMModel {
  const comparison = calculateCostComparison(inputTokens, outputTokens);
  return comparison[0].model;
}

// Get best value model (balance of cost and capability)
export function getBestValueModel(task: 'summary' | 'analysis' | 'creative' | 'code'): LLMModel {
  const taskModels = {
    summary: ['claude-3-5-haiku', 'gpt-4o-mini', 'gemini-1.5-flash'],
    analysis: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
    creative: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'gpt-4o'],
    code: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet']
  };
  
  return taskModels[task][1] as LLMModel; // Second option is usually best value
}