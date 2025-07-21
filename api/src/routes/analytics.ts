import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /analytics/usage - Get user usage analytics
router.get('/usage', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { period = '30d', service } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Build where clause
    const whereClause: any = {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    if (service) {
      whereClause.service = service;
    }

    // Get usage records
    const usageRecords = await prisma.usage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 1000 // Limit to prevent large responses
    });

    // Calculate totals
    const totals = usageRecords.reduce((acc, record) => {
      acc.totalRequests += 1;
      acc.totalCost += parseFloat(record.cost);
      acc.totalDuration += record.duration;
      
      if (record.service === 'transcription') {
        acc.transcriptionRequests += 1;
        acc.transcriptionCost += parseFloat(record.cost);
      } else if (record.service === 'llm') {
        acc.llmRequests += 1;
        acc.llmCost += parseFloat(record.cost);
        acc.totalTokens += record.inputTokens + record.outputTokens;
      }
      
      return acc;
    }, {
      totalRequests: 0,
      totalCost: 0,
      totalDuration: 0,
      transcriptionRequests: 0,
      transcriptionCost: 0,
      llmRequests: 0,
      llmCost: 0,
      totalTokens: 0
    });

    // Group by date for chart data
    const dailyStats = usageRecords.reduce((acc, record) => {
      const date = record.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          requests: 0,
          cost: 0,
          transcriptionRequests: 0,
          llmRequests: 0
        };
      }
      
      acc[date].requests += 1;
      acc[date].cost += parseFloat(record.cost);
      
      if (record.service === 'transcription') {
        acc[date].transcriptionRequests += 1;
      } else if (record.service === 'llm') {
        acc[date].llmRequests += 1;
      }
      
      return acc;
    }, {} as Record<string, any>);

    res.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totals: {
        ...totals,
        totalCost: totals.totalCost.toFixed(6),
        transcriptionCost: totals.transcriptionCost.toFixed(6),
        llmCost: totals.llmCost.toFixed(6)
      },
      dailyStats: Object.values(dailyStats).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
      recentActivity: usageRecords.slice(0, 20).map(record => ({
        id: record.id,
        service: record.service,
        provider: record.provider,
        cost: parseFloat(record.cost),
        duration: record.duration,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        createdAt: record.createdAt
      }))
    });

  } catch (error) {
    console.error('Failed to get usage analytics:', error);
    res.status(500).json({ 
      error: 'Failed to get usage analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /analytics/costs - Get cost breakdown
router.get('/costs', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { period = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get usage grouped by provider
    const usageByProvider = await prisma.usage.groupBy({
      by: ['provider', 'service'],
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        cost: true,
        inputTokens: true,
        outputTokens: true,
        duration: true
      },
      _count: {
        id: true
      }
    });

    const costBreakdown = usageByProvider.map(item => ({
      provider: item.provider,
      service: item.service,
      totalCost: parseFloat(item._sum.cost || '0'),
      requestCount: item._count.id,
      totalTokens: (item._sum.inputTokens || 0) + (item._sum.outputTokens || 0),
      totalDuration: item._sum.duration || 0
    }));

    // Calculate service totals
    const serviceBreakdown = costBreakdown.reduce((acc, item) => {
      if (!acc[item.service]) {
        acc[item.service] = {
          service: item.service,
          totalCost: 0,
          requestCount: 0,
          providers: []
        };
      }
      
      acc[item.service].totalCost += item.totalCost;
      acc[item.service].requestCount += item.requestCount;
      acc[item.service].providers.push({
        provider: item.provider,
        cost: item.totalCost,
        requests: item.requestCount
      });
      
      return acc;
    }, {} as Record<string, any>);

    const totalCost = costBreakdown.reduce((sum, item) => sum + item.totalCost, 0);

    res.json({
      period,
      totalCost: totalCost.toFixed(6),
      costBreakdown,
      serviceBreakdown: Object.values(serviceBreakdown),
      topProviders: costBreakdown
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5)
    });

  } catch (error) {
    console.error('Failed to get cost analytics:', error);
    res.status(500).json({ 
      error: 'Failed to get cost analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /analytics/performance - Get performance metrics
router.get('/performance', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { period = '30d', service } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - (period === '7d' ? 7 : period === '90d' ? 90 : 30));

    const whereClause: any = {
      userId,
      createdAt: { gte: startDate, lte: endDate }
    };

    if (service) {
      whereClause.service = service;
    }

    const usageRecords = await prisma.usage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    // Calculate performance metrics
    const durations = usageRecords.map(r => r.duration).filter(d => d > 0);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const medianDuration = durations.length > 0 ? durations.sort()[Math.floor(durations.length / 2)] : 0;
    const p95Duration = durations.length > 0 ? durations.sort()[Math.floor(durations.length * 0.95)] : 0;

    // Error analysis
    const errorRecords = usageRecords.filter(r => r.status === 'error');
    const errorRate = usageRecords.length > 0 ? (errorRecords.length / usageRecords.length) * 100 : 0;

    // Provider performance comparison
    const providerPerformance = usageRecords.reduce((acc, record) => {
      if (!acc[record.provider]) {
        acc[record.provider] = {
          provider: record.provider,
          avgDuration: 0,
          requestCount: 0,
          errorCount: 0,
          totalDuration: 0
        };
      }
      
      acc[record.provider].requestCount += 1;
      acc[record.provider].totalDuration += record.duration;
      if (record.status === 'error') {
        acc[record.provider].errorCount += 1;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages
    Object.values(providerPerformance).forEach((provider: any) => {
      provider.avgDuration = provider.totalDuration / provider.requestCount;
      provider.errorRate = (provider.errorCount / provider.requestCount) * 100;
    });

    res.json({
      period,
      overview: {
        totalRequests: usageRecords.length,
        avgDuration: Number(avgDuration.toFixed(2)),
        medianDuration: Number(medianDuration.toFixed(2)),
        p95Duration: Number(p95Duration.toFixed(2)),
        errorRate: Number(errorRate.toFixed(2))
      },
      providerPerformance: Object.values(providerPerformance)
        .sort((a: any, b: any) => a.avgDuration - b.avgDuration),
      recentErrors: errorRecords.slice(0, 10).map(record => ({
        id: record.id,
        service: record.service,
        provider: record.provider,
        error: record.error,
        createdAt: record.createdAt
      }))
    });

  } catch (error) {
    console.error('Failed to get performance analytics:', error);
    res.status(500).json({ 
      error: 'Failed to get performance analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;