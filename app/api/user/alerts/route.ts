import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/libs/prisma';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || '';

// Get user's cost alerts
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId: string;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await prisma.costAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ alerts });

  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json({ 
      error: 'Failed to get alerts',
      details: error.message 
    }, { status: 500 });
  }
}

// Create new cost alert
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId: string;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { alertType, threshold, period } = body;

    if (!alertType || !threshold || !period) {
      return NextResponse.json({ 
        error: 'Missing required fields: alertType, threshold, period' 
      }, { status: 400 });
    }

    if (!['monthly_budget', 'daily_limit', 'per_request'].includes(alertType)) {
      return NextResponse.json({ 
        error: 'Invalid alertType. Must be: monthly_budget, daily_limit, or per_request' 
      }, { status: 400 });
    }

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return NextResponse.json({ 
        error: 'Invalid period. Must be: daily, weekly, or monthly' 
      }, { status: 400 });
    }

    const alert = await prisma.costAlert.create({
      data: {
        userId,
        alertType,
        threshold: parseFloat(threshold),
        period
      }
    });

    return NextResponse.json({ alert });

  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json({ 
      error: 'Failed to create alert',
      details: error.message 
    }, { status: 500 });
  }
}

// Update alert
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let userId: string;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { alertId, threshold, isActive } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'alertId required' }, { status: 400 });
    }

    // Verify alert ownership
    const existingAlert = await prisma.costAlert.findFirst({
      where: { id: alertId, userId }
    });

    if (!existingAlert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const updatedAlert = await prisma.costAlert.update({
      where: { id: alertId },
      data: {
        ...(threshold !== undefined && { threshold: parseFloat(threshold) }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return NextResponse.json({ alert: updatedAlert });

  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json({ 
      error: 'Failed to update alert',
      details: error.message 
    }, { status: 500 });
  }
}

// Delete alert
export async function DELETE(req: NextRequest) {
  try {
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
    const alertId = searchParams.get('id');

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID required' }, { status: 400 });
    }

    // Verify alert ownership
    const existingAlert = await prisma.costAlert.findFirst({
      where: { id: alertId, userId }
    });

    if (!existingAlert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    await prisma.costAlert.delete({
      where: { id: alertId }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete alert',
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}