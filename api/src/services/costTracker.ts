import prisma from '../utils/database';
import { UsageMetrics } from '../shared/types';
import { logger } from '../utils/logger';

export class CostTracker {
  
  // Track individual usage event
  static async trackUsage(metrics: UsageMetrics): Promise<any> {
    try {
      // Store detailed usage record
      const usage = await prisma.userUsage.create({
        data: {
          userId: metrics.userId,
          serviceType: metrics.serviceType,
          provider: metrics.provider,
          model: metrics.model,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          audioSeconds: metrics.audioSeconds,
          durationSeconds: metrics.durationSeconds,
          inputCostUsd: metrics.inputCostUsd,
          outputCostUsd: metrics.outputCostUsd,
          totalCostUsd: metrics.totalCostUsd,
          requestSize: metrics.requestSize,
          quality: metrics.quality,
          language: metrics.language,
          success: metrics.success ?? true,
          errorMessage: metrics.errorMessage
        }
      });

      // Update daily summary (upsert)
      await this.updateDailySummary(metrics.userId, metrics);
      
      // Check cost alerts
      await this.checkCostAlerts(metrics.userId, metrics.totalCostUsd);
      
      logger.info('Usage tracked successfully', { userId: metrics.userId, cost: metrics.totalCostUsd });
      return usage;
    } catch (error) {
      logger.error('Cost tracking failed', error as Error, { userId: metrics.userId });
      // Don't throw - we don't want cost tracking to break the main request
    }
  }

  // Update daily summary for fast analytics
  private static async updateDailySummary(userId: string, metrics: UsageMetrics) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    const costField = metrics.serviceType === 'transcription' ? 'transcriptionCost' : 'llmCost';
    const requestField = metrics.serviceType === 'transcription' ? 'transcriptionRequests' : 'llmRequests';

    await prisma.costSummary.upsert({
      where: {
        userId_date_period: {
          userId,
          date: today,
          period: 'daily'
        }
      },
      update: {
        [costField]: { increment: metrics.totalCostUsd },
        totalCost: { increment: metrics.totalCostUsd },
        [requestField]: { increment: 1 },
        totalRequests: { increment: 1 },
        updatedAt: new Date()
      },
      create: {
        userId,
        date: today,
        period: 'daily',
        [costField]: metrics.totalCostUsd,
        totalCost: metrics.totalCostUsd,
        [requestField]: 1,
        totalRequests: 1
      }
    });
  }

  // Check if any cost alerts should trigger
  private static async checkCostAlerts(userId: string, costUsd: number) {
    const alerts = await prisma.costAlert.findMany({
      where: { userId, isActive: true }
    });

    for (const alert of alerts) {
      let shouldTrigger = false;
      let currentSpend = 0;

      const now = new Date();
      let periodStart = new Date();

      switch (alert.period) {
        case 'daily':
          periodStart.setHours(0, 0, 0, 0);
          break;
        case 'weekly':
          periodStart.setDate(now.getDate() - now.getDay());
          periodStart.setHours(0, 0, 0, 0);
          break;
        case 'monthly':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      // Calculate current period spend
      const periodUsage = await prisma.userUsage.aggregate({
        where: {
          userId,
          createdAt: { gte: periodStart }
        },
        _sum: { totalCostUsd: true }
      });

      currentSpend = periodUsage._sum.totalCostUsd || 0;

      // Check threshold
      if (currentSpend >= alert.threshold) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        await this.triggerAlert(alert, currentSpend);
      }
    }
  }

  private static async triggerAlert(alert: any, currentSpend: number) {
    // Update alert record
    await prisma.costAlert.update({
      where: { id: alert.id },
      data: {
        lastTriggered: new Date(),
        triggerCount: { increment: 1 }
      }
    });

    // Log alert
    logger.warn('Cost Alert Triggered', {
      userId: alert.userId,
      alertType: alert.alertType,
      threshold: alert.threshold,
      currentSpend: currentSpend,
      timestamp: new Date().toISOString()
    });

    // Here you could:
    // - Send email notification
    // - Post to Slack webhook
    // - Disable user's access temporarily
    // - Log to monitoring system
  }

  // Get user's current costs
  static async getUserCosts(userId: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly') {
    const now = new Date();
    let periodStart = new Date();

    switch (period) {
      case 'daily':
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        periodStart.setDate(now.getDate() - now.getDay());
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get detailed breakdown
    const usage = await prisma.userUsage.groupBy({
      by: ['serviceType', 'provider'],
      where: {
        userId,
        createdAt: { gte: periodStart }
      },
      _sum: {
        totalCostUsd: true,
        inputTokens: true,
        outputTokens: true,
        audioSeconds: true
      },
      _count: { id: true }
    });

    const totalCost = usage.reduce((sum, item) => sum + (item._sum.totalCostUsd || 0), 0);

    return {
      totalCost,
      breakdown: usage,
      period,
      periodStart
    };
  }
}

// Helper to calculate costs for different providers
export class CostCalculator {
  
  static calculateTranscriptionCost(provider: string, audioSeconds: number): number {
    const rates: Record<string, number> = {
      'rev-turbo': 0.18 / 3600,           // $0.18/hour
      'assemblyai-streaming': 0.15 / 3600, // $0.15/hour  
      'deepgram-nova3': 0.258 / 3600,     // $0.258/hour
      'whisper-api': 0.36 / 3600          // $0.36/hour
    };
    
    return (rates[provider] || 0) * audioSeconds;
  }

  static calculateLLMCost(model: string, inputTokens: number, outputTokens: number): { inputCost: number; outputCost: number; total: number } {
    const rates: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.50 / 1000000, output: 10.00 / 1000000 },
      'gpt-4o-mini': { input: 0.15 / 1000000, output: 0.60 / 1000000 },
      'claude-3-5-sonnet': { input: 3.00 / 1000000, output: 15.00 / 1000000 },
      'claude-3-5-haiku': { input: 0.25 / 1000000, output: 1.25 / 1000000 },
      'gemini-1.5-pro': { input: 1.25 / 1000000, output: 5.00 / 1000000 },
      'gemini-1.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 }
    };

    const rate = rates[model] || rates['gpt-4o-mini'];
    const inputCost = inputTokens * (rate?.input || 0);
    const outputCost = outputTokens * (rate?.output || 0);
    
    return {
      inputCost,
      outputCost,
      total: inputCost + outputCost
    };
  }
}