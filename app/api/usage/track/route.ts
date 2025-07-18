import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import prisma from "@/libs/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-secret-key";

// Track usage for Cloud tier users
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, tokensUsed } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!tokensUsed || tokensUsed <= 0) {
      return NextResponse.json({ error: "Invalid token count" }, { status: 400 });
    }

    // Verify JWT token
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
    } catch (error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get user and check if they're on Cloud plan
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        plan: true,
        usageLimit: true,
        usageCount: true,
        lastUsageReset: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.plan !== "cloud") {
      return NextResponse.json({ error: "Usage tracking only available for Cloud plan" }, { status: 403 });
    }

    // Check if we need to reset monthly usage
    const now = new Date();
    const shouldReset = !user.lastUsageReset || 
      (now.getMonth() !== user.lastUsageReset.getMonth() || 
       now.getFullYear() !== user.lastUsageReset.getFullYear());

    let newUsageCount = user.usageCount || 0;
    let resetDate = user.lastUsageReset;

    if (shouldReset) {
      newUsageCount = 0;
      resetDate = now;
    }

    // Add new usage
    newUsageCount += tokensUsed;

    // Check if user has exceeded their limit
    const limit = user.usageLimit || 10000; // Default 10k tokens
    if (newUsageCount > limit) {
      return NextResponse.json({ 
        error: "Usage limit exceeded",
        usage: {
          current: newUsageCount,
          limit: limit,
          remaining: 0
        }
      }, { status: 429 });
    }

    // Update user usage
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        usageCount: newUsageCount,
        lastUsageReset: resetDate,
      },
    });

    return NextResponse.json({
      message: "Usage tracked successfully",
      usage: {
        current: newUsageCount,
        limit: limit,
        remaining: limit - newUsageCount
      }
    });
  } catch (error) {
    console.error("Error tracking usage:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Get current usage for a user
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Verify JWT token
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
    } catch (error) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get user usage
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        plan: true,
        usageLimit: true,
        usageCount: true,
        lastUsageReset: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const limit = user.usageLimit || 10000;
    const current = user.usageCount || 0;

    return NextResponse.json({
      usage: {
        current,
        limit,
        remaining: Math.max(0, limit - current),
        resetDate: user.lastUsageReset
      }
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}