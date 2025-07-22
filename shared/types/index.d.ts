export interface User {
    id: string;
    email: string;
    name?: string;
    plan: 'free' | 'byok' | 'cloud';
    hasAccess: boolean;
    usageLimit?: number;
    usageCount?: number;
    hasApiKeys: boolean;
}
export interface JWTPayload {
    userId: string;
    email: string;
    plan: 'free' | 'byok' | 'cloud';
    hasAccess: boolean;
    hasApiKeys: boolean;
    iat: number;
    exp: number;
}
export type TranscriptionProvider = 'rev-turbo' | 'assemblyai-streaming' | 'deepgram-nova3' | 'whisper-api';
export interface TranscriptionRequest {
    audio: Buffer;
    provider?: TranscriptionProvider;
    quality?: 'fast' | 'balanced' | 'accurate';
    language?: string;
    streaming?: boolean;
}
export interface TranscriptionResult {
    text: string;
    provider: TranscriptionProvider;
    duration: number;
    cost: string;
    metadata?: {
        confidence?: number;
        language?: string;
        duration?: number;
        words?: Array<{
            text: string;
            start: number;
            end: number;
            confidence?: number;
        }>;
    };
}
export type LLMModel = 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet' | 'claude-3-5-haiku' | 'gemini-1.5-pro' | 'gemini-1.5-flash';
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMRequest {
    messages: LLMMessage[];
    model?: LLMModel;
    task?: 'summary' | 'analysis' | 'creative' | 'code';
    quality?: 'fast' | 'balanced' | 'accurate';
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}
export interface LLMResult {
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    model: string;
    duration: number;
    cost: string;
}
export interface UsageMetrics {
    userId: string;
    serviceType: 'transcription' | 'llm';
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    audioSeconds?: number;
    durationSeconds: number;
    inputCostUsd?: number;
    outputCostUsd?: number;
    totalCostUsd: number;
    requestSize?: number;
    quality?: string;
    language?: string;
    success?: boolean;
    errorMessage?: string;
}
export interface CostAnalytics {
    totalCost: number;
    period: 'daily' | 'weekly' | 'monthly';
    periodStart: Date;
    services: {
        transcription: {
            cost: number;
            requests: number;
            audioHours: number;
        };
        llm: {
            cost: number;
            requests: number;
            inputTokens: number;
            outputTokens: number;
        };
    };
    providers: Array<{
        provider: string;
        serviceType: string;
        cost: number;
        requests: number;
        tokens?: number;
        audioSeconds?: number;
    }>;
    efficiency: {
        costPerRequest: number;
        costPerToken: number;
        costPerAudioMinute: number;
    };
}
export interface WebSocketMessage {
    type: 'connected' | 'error' | 'partial_transcript' | 'final_transcript' | 'end_of_stream';
    data?: any;
    error?: string;
    sessionId?: string;
}
export interface StreamingTranscriptionMessage {
    type: 'partial_transcript' | 'final_transcript';
    text: string;
    confidence: number;
    is_final: boolean;
    timestamp?: number;
    cost?: string;
    duration?: number;
}
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: any) => string | null;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
    retryAfter?: number;
}
export interface APIError extends Error {
    code?: string;
    statusCode?: number;
    retryAfter?: number;
}
export interface HealthCheck {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    version: string;
    services: {
        database: 'healthy' | 'unhealthy';
        providers: Record<string, 'healthy' | 'unhealthy'>;
    };
}
//# sourceMappingURL=index.d.ts.map