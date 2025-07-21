#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating secure environment keys for Whisnap...\n');

// Generate encryption key (32 bytes = 64 hex chars)
const encryptionKey = crypto.randomBytes(32).toString('hex');

// Generate JWT secret (32 bytes = 64 hex chars)  
const jwtSecret = crypto.randomBytes(32).toString('hex');

// Generate NextAuth secret (32 bytes = 64 hex chars)
const nextAuthSecret = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated encryption keys:');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`NEXTAUTH_SECRET=${nextAuthSecret}\n`);

// Create .env.example if it doesn't exist
const envExamplePath = path.join(process.cwd(), '.env.example');
const envExampleContent = `# Security Keys (generate new ones for production)
ENCRYPTION_KEY=${encryptionKey}
JWT_SECRET=${jwtSecret}
NEXTAUTH_SECRET=${nextAuthSecret}

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/whisnap"

# Email (Resend)
RESEND_API_KEY=your_resend_api_key_here

# AI Provider API Keys (for cloud tier)
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-your-anthropic-key-here
REV_AI_API_KEY=your-rev-ai-key-here
ASSEMBLYAI_API_KEY=your-assemblyai-key-here
DEEPGRAM_API_KEY=your-deepgram-key-here
GOOGLE_AI_API_KEY=your-google-ai-key-here

# Optional: Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Optional: Monitoring
SENTRY_DSN=your_sentry_dsn_here
`;

fs.writeFileSync(envExamplePath, envExampleContent);
console.log('✅ Created .env.example with secure defaults');

// Check if .env.local exists
const envLocalPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envLocalPath)) {
  fs.writeFileSync(envLocalPath, envExampleContent);
  console.log('✅ Created .env.local with generated keys');
  console.log('🔧 Please update the API keys in .env.local with your actual values\n');
} else {
  console.log('⚠️  .env.local already exists - add these keys manually:\n');
  console.log(`ENCRYPTION_KEY=${encryptionKey}`);
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`NEXTAUTH_SECRET=${nextAuthSecret}\n`);
}

console.log('🔒 Security Checklist:');
console.log('□ Keep these keys secret and never commit them to git');
console.log('□ Use different keys for development, staging, and production');
console.log('□ Rotate keys regularly (every 90 days)');
console.log('□ Store production keys in a secure vault');
console.log('□ Monitor for any key leaks in logs or error messages\n');

console.log('🚀 Next steps:');
console.log('1. Update .env.local with your API keys');
console.log('2. Run: npm run db:migrate');
console.log('3. Start development: npm run dev');