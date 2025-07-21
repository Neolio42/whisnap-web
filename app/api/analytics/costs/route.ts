import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { CostTracker } from '@/libs/cost-tracker';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || '';

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    let userId: string;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') as 'daily' | 'weekly' | 'monthly') || 'monthly';

    // Get user's cost breakdown
    const costs = await CostTracker.getUserCosts(userId, period);

    // Format for dashboard
    const dashboard = {
      totalCost: Number(costs.totalCost.toFixed(4)),
      period,
      periodStart: costs.periodStart,
      
      // Service breakdown
      services: {
        transcription: {
          cost: costs.breakdown
            .filter(b => b.serviceType === 'transcription')
            .reduce((sum, b) => sum + (b._sum.totalCostUsd || 0), 0),
          requests: costs.breakdown
            .filter(b => b.serviceType === 'transcription')
            .reduce((sum, b) => sum + b._count.id, 0),
          audioHours: costs.breakdown
            .filter(b => b.serviceType === 'transcription')
            .reduce((sum, b) => sum + (b._sum.audioSeconds || 0), 0) / 3600
        },
        llm: {
          cost: costs.breakdown
            .filter(b => b.serviceType === 'llm')
            .reduce((sum, b) => sum + (b._sum.totalCostUsd || 0), 0),
          requests: costs.breakdown
            .filter(b => b.serviceType === 'llm')
            .reduce((sum, b) => sum + b._count.id, 0),
          inputTokens: costs.breakdown
            .filter(b => b.serviceType === 'llm')
            .reduce((sum, b) => sum + (b._sum.inputTokens || 0), 0),
          outputTokens: costs.breakdown
            .filter(b => b.serviceType === 'llm')
            .reduce((sum, b) => sum + (b._sum.outputTokens || 0), 0)
        }
      },

      // Provider breakdown
      providers: costs.breakdown.map(item => ({
        provider: item.provider,
        serviceType: item.serviceType,
        cost: Number((item._sum.totalCostUsd || 0).toFixed(4)),
        requests: item._count.id,
        tokens: (item._sum.inputTokens || 0) + (item._sum.outputTokens || 0),
        audioSeconds: item._sum.audioSeconds || 0
      })).sort((a, b) => b.cost - a.cost),

      // Cost efficiency metrics
      efficiency: {
        costPerRequest: costs.breakdown.length > 0 
          ? Number((costs.totalCost / costs.breakdown.reduce((sum, b) => sum + b._count.id, 0)).toFixed(4))
          : 0,
        costPerToken: costs.breakdown
          .filter(b => b.serviceType === 'llm')
          .reduce((sum, b) => sum + (b._sum.inputTokens || 0) + (b._sum.outputTokens || 0), 0) > 0
          ? Number((costs.breakdown
              .filter(b => b.serviceType === 'llm')
              .reduce((sum, b) => sum + (b._sum.totalCostUsd || 0), 0) /
            costs.breakdown
              .filter(b => b.serviceType === 'llm')
              .reduce((sum, b) => sum + (b._sum.inputTokens || 0) + (b._sum.outputTokens || 0), 0)
            * 1000).toFixed(6))
          : 0,
        costPerAudioMinute: costs.breakdown
          .filter(b => b.serviceType === 'transcription')
          .reduce((sum, b) => sum + (b._sum.audioSeconds || 0), 0) > 0
          ? Number((costs.breakdown
              .filter(b => b.serviceType === 'transcription')
              .reduce((sum, b) => sum + (b._sum.totalCostUsd || 0), 0) /
            (costs.breakdown
              .filter(b => b.serviceType === 'transcription')
              .reduce((sum, b) => sum + (b._sum.audioSeconds || 0), 0) / 60)
            ).toFixed(4))
          : 0
      }
    };

    return NextResponse.json(dashboard);

  } catch (error) {
    console.error('Cost analytics error:', error);
    return NextResponse.json({ 
      error: 'Failed to get cost analytics',
      details: error.message 
    }, { status: 500 });
  }
}

// OPTIONS for CORS
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}