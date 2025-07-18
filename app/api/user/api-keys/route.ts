import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import prisma from "@/libs/prisma";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "your-32-char-secret-key-here!";

// Simple encryption for API keys
function encrypt(text: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText: string): string {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// GET - Retrieve user's API keys (masked for security)
export async function GET(req: NextRequest) {
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

    // Only return masked keys for security
    const apiKeys = user.apiKeys as any;
    const maskedKeys = apiKeys ? {
      openai: apiKeys.openai ? `sk-...${apiKeys.openai.slice(-4)}` : null,
      anthropic: apiKeys.anthropic ? `sk-...${apiKeys.anthropic.slice(-4)}` : null,
    } : { openai: null, anthropic: null };

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

    // Encrypt keys before storing
    const encryptedKeys: any = {};
    if (openaiKey) encryptedKeys.openai = encrypt(openaiKey);
    if (anthropicKey) encryptedKeys.anthropic = encrypt(anthropicKey);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        apiKeys: encryptedKeys,
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