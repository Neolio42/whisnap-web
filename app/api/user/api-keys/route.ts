import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import prisma from "@/libs/prisma";
import { EncryptionService } from "@/libs/encryption";
import { RateLimiter, RATE_LIMITS } from "@/libs/rate-limiter";

// GET - Retrieve user's API keys (masked for security)
export async function GET(req: NextRequest) {
  // Rate limiting
  const rateLimit = await RateLimiter.checkLimit(req, RATE_LIMITS.API_DEFAULT);
  if (!rateLimit.allowed) {
    return NextResponse.json({ 
      error: "Rate limit exceeded",
      retryAfter: rateLimit.retryAfter 
    }, { status: 429 });
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { apiKeys: true, plan: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Decrypt and mask keys for security
    let maskedKeys: { openai: string | null; anthropic: string | null } = { openai: null, anthropic: null };
    
    if (user.apiKeys) {
      try {
        const decryptedKeys = EncryptionService.decryptApiKeys(user.apiKeys as string);
        maskedKeys = {
          openai: decryptedKeys.openai ? `sk-...${decryptedKeys.openai.slice(-4)}` : null,
          anthropic: decryptedKeys.anthropic ? `sk-...${decryptedKeys.anthropic.slice(-4)}` : null,
        };
      } catch (error) {
        console.error('Failed to decrypt API keys:', error);
        // Return null keys if decryption fails
      }
    }

    return NextResponse.json({
      apiKeys: maskedKeys,
      plan: user.plan,
    });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Update user's API keys
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimit = await RateLimiter.checkLimit(req, RATE_LIMITS.API_DEFAULT);
  if (!rateLimit.allowed) {
    return NextResponse.json({ 
      error: "Rate limit exceeded",
      retryAfter: rateLimit.retryAfter 
    }, { status: 429 });
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { openaiKey, anthropicKey } = body;

    // Validate API key formats
    if (openaiKey && !openaiKey.startsWith('sk-')) {
      return NextResponse.json({ error: "Invalid OpenAI API key format" }, { status: 400 });
    }

    if (anthropicKey && !anthropicKey.startsWith('sk-')) {
      return NextResponse.json({ error: "Invalid Anthropic API key format" }, { status: 400 });
    }

    // Prepare keys object for encryption
    const keysToStore: Record<string, string> = {};
    if (openaiKey) keysToStore.openai = openaiKey;
    if (anthropicKey) keysToStore.anthropic = anthropicKey;

    // Encrypt the entire keys object
    const encryptedApiKeys = EncryptionService.encryptApiKeys(keysToStore);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        apiKeys: encryptedApiKeys,
        plan: "byok", // Automatically set to BYOK plan when API keys are added
      },
    });

    return NextResponse.json({ 
      message: "API keys updated successfully",
      plan: user.plan
    });
  } catch (error) {
    console.error("Error updating API keys:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Remove user's API keys
export async function DELETE(req: NextRequest) {
  // Rate limiting
  const rateLimit = await RateLimiter.checkLimit(req, RATE_LIMITS.API_DEFAULT);
  if (!rateLimit.allowed) {
    return NextResponse.json({ 
      error: "Rate limit exceeded",
      retryAfter: rateLimit.retryAfter 
    }, { status: 429 });
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        apiKeys: null,
        plan: "free", // Reset to free plan when API keys are removed
      },
    });

    return NextResponse.json({ 
      message: "API keys removed successfully",
      plan: user.plan
    });
  } catch (error) {
    console.error("Error removing API keys:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}