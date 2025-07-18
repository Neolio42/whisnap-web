import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import prisma from "@/libs/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key";

// Generate JWT token for desktop app
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true,
        email: true,
        name: true,
        plan: true,
        hasAccess: true,
        usageLimit: true,
        usageCount: true,
        apiKeys: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate JWT token for desktop app
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        hasAccess: user.hasAccess,
        usageLimit: user.usageLimit,
        usageCount: user.usageCount,
        hasApiKeys: !!user.apiKeys,
      },
      JWT_SECRET,
      { expiresIn: "30d" } // Token valid for 30 days
    );

    // Redirect to desktop app with token
    const desktopUrl = `whisnap://auth?token=${token}`;
    
    return NextResponse.redirect(desktopUrl);
  } catch (error) {
    console.error("Error generating desktop token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Verify desktop app token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Get fresh user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true,
        email: true,
        name: true,
        plan: true,
        hasAccess: true,
        usageLimit: true,
        usageCount: true,
        apiKeys: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        hasAccess: user.hasAccess,
        usageLimit: user.usageLimit,
        usageCount: user.usageCount,
        hasApiKeys: !!user.apiKeys,
      }
    });
  } catch (error) {
    console.error("Error verifying token:", error);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}