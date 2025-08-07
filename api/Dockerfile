# =============================================================================
# Express API Dockerfile
# =============================================================================

FROM node:20-bookworm-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files
COPY api/package.json api/package-lock.json ./
RUN npm ci

# Copy source files and shared types
COPY api/src/ ./src/
COPY api/tsconfig.json ./
COPY shared/ ./shared/
COPY api/prisma/ ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Build shared types first (outputs to shared/dist/)
RUN cd shared && npx tsc

# Fix paths for Docker build (shared is at ./shared not ../shared)
RUN sed -i '/"references":/d' tsconfig.json && \
    sed -i 's|"../shared/dist/\*"|"./shared/dist/*"|g' tsconfig.json

# Build API (can now reference shared/dist/)  
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/shared ./shared

# Create an empty .env file (will be overwritten by GitHub Actions if needed)
RUN touch .env

# Create logs directory
RUN mkdir -p logs

EXPOSE 4000 4001

# Health check using node instead of curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "dist/server.js"]