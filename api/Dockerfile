# =============================================================================
# Express API Dockerfile
# =============================================================================

FROM node:20-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci --only=production; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install ALL dependencies for build (including dev deps like TypeScript)
COPY api/package.json api/package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Copy API source files only
COPY api/src/ ./src/
COPY api/prisma/ ./prisma/
COPY api/tsconfig.json ./
COPY shared/ ./shared/

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production image, copy all the files and run the API
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

# Copy built application
COPY --from=builder --chown=apiuser:nodejs /app/dist ./dist
COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=apiuser:nodejs /app/package.json ./package.json

# Copy Prisma files for runtime
COPY --from=builder --chown=apiuser:nodejs /app/prisma ./prisma

# Create logs directory
RUN mkdir -p logs && chown apiuser:nodejs logs

USER apiuser

# Expose API port and WebSocket port
EXPOSE 4000 4001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/v1/health || exit 1

CMD ["npm", "start"]