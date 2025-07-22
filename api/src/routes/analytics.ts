import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Admin access control
const ADMIN_EMAIL = 'nedeliss@gmail.com';
const ADMIN_USER_ID = 'cmddieu5i000011zma5p761oo';

const requireAdmin = (req: any, res: any, next: any) => {
  const isAdmin = req.user?.email === ADMIN_EMAIL || req.user?.userId === ADMIN_USER_ID;
  if (!isAdmin) {
    console.warn('Admin access denied:', { email: req.user?.email, userId: req.user?.userId });
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /analytics/users - Get all users (admin only)
router.get('/users', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        plan: true,
        usageCount: true,
        hasAccess: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Failed to get users:', error);
    res.status(500).json({ 
      error: 'Failed to get users',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /analytics/stats - Get system statistics (admin only)
router.get('/stats', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      totalUsers,
      totalRequests, 
      totalCost,
      activeUsers7d,
      activeUsers30d,
      newSignupsThisMonth,
      newSignupsLastMonth,
      planBreakdown,
      recentActivity,
      topUsers,
      serviceBreakdown,
      errorRate
    ] = await Promise.all([
      // Basic stats
      prisma.user.count(),
      prisma.userUsage.count(),
      prisma.userUsage.aggregate({
        _sum: { totalCostUsd: true }
      }),
      
      // Active users (users with usage in last 7/30 days)
      prisma.user.count({
        where: {
          usage: {
            some: {
              createdAt: { gte: last7Days }
            }
          }
        }
      }),
      prisma.user.count({
        where: {
          usage: {
            some: {
              createdAt: { gte: last30Days }
            }
          }
        }
      }),
      
      // New signups this month vs last month
      prisma.user.count({
        where: {
          createdAt: {
            gte: thisMonth,
            lte: thisMonthEnd
          }
        }
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: lastMonth,
            lt: thisMonth
          }
        }
      }),
      
      // Plan breakdown
      prisma.user.groupBy({
        by: ['plan'],
        _count: { plan: true }
      }),
      
      // Recent activity (last 10 signups)
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          email: true,
          plan: true,
          createdAt: true,
          usageCount: true
        }
      }),
      
      // Top users by usage
      prisma.user.findMany({
        where: {
          usageCount: { gt: 0 }
        },
        orderBy: { usageCount: 'desc' },
        take: 10,
        select: {
          email: true,
          plan: true,
          usageCount: true,
          usage: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
          }
        }
      }),
      
      // Service type breakdown
      prisma.userUsage.groupBy({
        by: ['serviceType'],
        _count: { serviceType: true },
        _sum: { totalCostUsd: true }
      }),
      
      // Error rate (last 7 days) - get total and successful requests separately
      Promise.all([
        prisma.userUsage.count({
          where: {
            createdAt: { gte: last7Days }
          }
        }),
        prisma.userUsage.count({
          where: {
            createdAt: { gte: last7Days },
            success: true
          }
        })
      ])
    ]);

    // Calculate trends
    const signupTrend = newSignupsLastMonth > 0 
      ? ((newSignupsThisMonth - newSignupsLastMonth) / newSignupsLastMonth * 100)
      : 0;

    // Calculate error rate percentage
    const [totalRequests7d, successfulRequests] = errorRate;
    const errorRatePercent = totalRequests7d > 0 
      ? ((totalRequests7d - successfulRequests) / totalRequests7d * 100) 
      : 0;

    res.json({
      // Basic metrics
      totalUsers,
      totalRequests,
      totalCost: totalCost._sum.totalCostUsd || 0,
      
      // User activity metrics
      activeUsers7d,
      activeUsers30d,
      newSignupsThisMonth,
      signupTrend,
      
      // Plan distribution
      planBreakdown: planBreakdown.map(p => ({
        plan: p.plan || 'free',
        count: p._count.plan
      })),
      
      // Recent activity
      recentActivity: recentActivity.map(user => ({
        email: user.email,
        plan: user.plan || 'free',
        signupTime: user.createdAt,
        usageCount: user.usageCount
      })),
      
      // Top users
      topUsers: topUsers.map(user => ({
        email: user.email,
        plan: user.plan || 'free',
        usageCount: user.usageCount,
        lastActive: user.usage[0]?.createdAt || null
      })),
      
      // Service breakdown
      serviceBreakdown: serviceBreakdown.map(s => ({
        service: s.serviceType,
        requests: s._count.serviceType,
        cost: s._sum.totalCostUsd || 0
      })),
      
      // System health
      errorRate: Math.round(errorRatePercent * 100) / 100
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ 
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /analytics/usage - Get usage data (admin sees all, users see their own)
router.get('/usage', authenticateUser, async (req, res) => {
  try {
    const isAdmin = req.user?.email === ADMIN_EMAIL || req.user?.userId === ADMIN_USER_ID;
    
    if (isAdmin) {
      // Admin sees all usage
      const usageData = await prisma.userUsage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: {
            select: {
              email: true
            }
          }
        }
      });
      
      return res.json(usageData);
    }

    // Regular user sees only their usage
    const userId = req.user!.userId;
    const { period = '30d', service } = req.query;

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

    const whereClause: any = {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    if (service) {
      whereClause.serviceType = service;
    }

    const usageRecords = await prisma.userUsage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 1000
    });

    res.json(usageRecords);
  } catch (error) {
    console.error('Failed to get usage:', error);
    res.status(500).json({ 
      error: 'Failed to get usage',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /analytics/sync-usage-counts - Sync user usage counts (admin only)
router.post('/sync-usage-counts', authenticateUser, requireAdmin, async (req, res) => {
  try {
    // Get all users with their actual usage count from UserUsage table
    const usersWithActualCounts = await prisma.$queryRaw`
      SELECT 
        u.id,
        u.email,
        u."usageCount" as current_count,
        COUNT(uu.id)::int as actual_count
      FROM "User" u
      LEFT JOIN "UserUsage" uu ON u.id = uu."userId"
      GROUP BY u.id, u.email, u."usageCount"
      ORDER BY u.email
    `;

    const updates = [];
    
    for (const user of usersWithActualCounts as any[]) {
      if (user.current_count !== user.actual_count) {
        updates.push({
          userId: user.id,
          email: user.email,
          currentCount: user.current_count,
          actualCount: user.actual_count
        });
        
        // Update the user's usage count
        await prisma.user.update({
          where: { id: user.id },
          data: { usageCount: user.actual_count }
        });
      }
    }

    res.json({
      message: `Synced usage counts for ${updates.length} users`,
      updates
    });
  } catch (error) {
    console.error('Failed to sync usage counts:', error);
    res.status(500).json({ 
      error: 'Failed to sync usage counts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;