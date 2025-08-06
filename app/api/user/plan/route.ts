import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/libs/prisma';

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

    // Get user with usage data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        email: true,
        name: true,
        plan: true,
        hasAccess: true,
        usageLimit: true,
        usageCount: true,
        lastUsageReset: true,
        apiKeys: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if usage counter needs reset (monthly)
    const now = new Date();
    const lastReset = user.lastUsageReset || user.createdAt;
    const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24);
    
    let currentUsage = user.usageCount || 0;
    if (daysSinceReset >= 30) {
      // Reset monthly usage
      await prisma.user.update({
        where: { id: userId },
        data: { 
          usageCount: 0,
          lastUsageReset: now
        }
      });
      currentUsage = 0;
    }

    // Get recent usage stats
    const recentUsage = await prisma.userUsage.findMany({
      where: { 
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const totalCost = recentUsage.reduce((sum, usage) => sum + usage.totalCostUsd, 0);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        hasAccess: user.hasAccess
      },
      usage: {
        current: currentUsage,
        limit: user.usageLimit,
        percentage: user.usageLimit ? Math.round((currentUsage / user.usageLimit) * 100) : null,
        resetDate: new Date(lastReset.getTime() + 30 * 24 * 60 * 60 * 1000)
      },
      apiKeys: {
        hasKeys: !!user.apiKeys,
        configured: user.apiKeys ? Object.keys(user.apiKeys).length : 0
      },
      billing: {
        monthlySpend: Number(totalCost.toFixed(4)),
        recentTransactions: recentUsage.length
      },
      features: {
        localTranscription: true,
        cloudTranscription: user.plan !== 'free',
        llmAccess: user.plan !== 'free',
        apiKeyManagement: user.plan === 'byok',
        usageTracking: user.plan === 'cloud'
      }
    });

  } catch (error) {
    console.error('Plan check error:', error);
    return NextResponse.json({ 
      error: 'Failed to get user plan',
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