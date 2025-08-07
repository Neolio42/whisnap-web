import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import prisma from '@/libs/prisma';
import crypto from 'crypto';

// Admin access control
const ADMIN_EMAIL = 'nedeliss@gmail.com';
const ADMIN_USER_ID = 'cmddieu5i000011zma5p761oo';

const isAdmin = (session: any) => {
  return session?.user?.email === ADMIN_EMAIL || session?.user?.id === ADMIN_USER_ID;
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || !isAdmin(session)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all invitations and leads
    const [invitations, leads] = await Promise.all([
      prisma.invitation.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return NextResponse.json({ invitations, leads });
  } catch (error) {
    console.error('Failed to fetch invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || !isAdmin(session)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { email } = await req.json();
    
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    // Check if invitation already exists
    const existingInvite = await prisma.invitation.findUnique({
      where: { email }
    });

    if (existingInvite && !existingInvite.used && existingInvite.expiresAt > new Date()) {
      return NextResponse.json({ error: 'Valid invitation already exists for this email' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists with this email' }, { status: 400 });
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create or update invitation
    const invitation = await prisma.invitation.upsert({
      where: { email },
      update: {
        token,
        expiresAt,
        used: false,
        usedBy: null,
        invitedBy: session.user.id!,
        updatedAt: new Date()
      },
      create: {
        email,
        token,
        expiresAt,
        invitedBy: session.user.id!
      }
    });

    // TODO: Send invitation email here
    console.log(`Invitation created for ${email} with token: ${token}`);

    return NextResponse.json({ 
      success: true, 
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt
      }
    });
  } catch (error) {
    console.error('Failed to create invitation:', error);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}