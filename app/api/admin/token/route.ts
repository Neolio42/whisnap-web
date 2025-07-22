import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/libs/next-auth';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Create a JWT token for Express API
    const token = jwt.sign(
      {
        userId: session.user.id,
        email: session.user.email,
        plan: 'cloud', // For admin testing
        hasAccess: true,
        aud: 'whisnap-api'
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '1h' }
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json({ error: 'Token generation failed' }, { status: 500 });
  }
}