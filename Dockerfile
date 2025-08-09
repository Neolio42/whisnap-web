# =============================================================================
# Multi-Stage Dockerfile: Next.js Web Application (Dev + Production)
# =============================================================================

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependencies stage ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build stage (Production) ----
FROM base AS build
# Install OpenSSL for Prisma and curl for health checks
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Copy all dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY app/ ./app/
COPY components/ ./components/
COPY libs/ ./libs/
COPY public/ ./public/
COPY prisma/ ./prisma/
COPY shared/ ./shared/
COPY types/ ./types/
COPY config.ts middleware.ts ./
COPY *.config.* ./
COPY tsconfig.json tailwind.config.js postcss.config.js next-sitemap.config.js next-env.d.ts ./

# Generate Prisma Client and build
RUN npx prisma generate && npm run build

# ---- Development stage ----
FROM base AS dev
# Install system dependencies
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Copy package files and install ALL dependencies (including dev dependencies)
COPY package.json package-lock.json ./
RUN npm ci

# Copy all source files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

ENV NODE_ENV=development
EXPOSE 3000

# Health check for development
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "run", "dev"]

# ---- Production runtime stage ----
FROM node:20-bookworm-slim AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Install runtime dependencies and create user
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma artifacts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Set permissions for Next.js cache
RUN mkdir .next && chown nextjs:nodejs .next

USER nextjs
EXPOSE 3000

# Health check with improved timing for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]