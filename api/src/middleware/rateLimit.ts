// Re-export rate limiting functions with the expected names
import { 
  transcriptionRateLimit, 
  llmRateLimit, 
  analyticsRateLimit 
} from './rateLimiter';

export const rateLimitTranscription = transcriptionRateLimit;
export const rateLimitLLM = llmRateLimit;
export const rateLimitAnalytics = analyticsRateLimit;