# =============================================================================
# Express API Dockerfile
# =============================================================================

FROM node:20-bookworm-slim AS base

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files
COPY api/package.json api/package-lock.json ./
RUN npm ci

# Copy source files
COPY api/src/ ./src/
COPY api/tsconfig.json ./
COPY shared/ ./shared/
COPY api/prisma/ ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
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

# Create logs directory
RUN mkdir -p logs

EXPOSE 4000 4001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/v1/health || exit 1

CMD ["node", "dist/server.js"]