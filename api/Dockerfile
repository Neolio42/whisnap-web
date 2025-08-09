# =============================================================================
# Multi-Stage Dockerfile: Express API (Dev + Production)
# =============================================================================

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# ---- Dependencies stage ----
FROM base AS deps
COPY api/package.json api/package-lock.json ./
RUN npm ci

# ---- Build stage (Production) ----
FROM base AS build
COPY api/package.json api/package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY api/src/ ./src/
COPY api/tsconfig.json ./
COPY api/prisma/ ./prisma/
COPY shared/ ./shared/

# Generate Prisma Client
RUN npx prisma generate

# Build shared types first (outputs to shared/dist/)
RUN cd shared && npx tsc

# Create Docker-specific tsconfig that removes references and fixes paths
RUN echo '{ "extends": "./tsconfig.json", "compilerOptions": { "paths": { "@shared/*": ["./shared/dist/*"] } }, "references": [] }' > tsconfig.docker.json

# Build API (can now reference shared/dist/)
RUN npx tsc -p tsconfig.docker.json

# ---- Development stage ----
FROM base AS dev
# Copy package files and install ALL dependencies (including dev dependencies)
COPY api/package.json api/package-lock.json ./
RUN npm ci

# Copy all source files
COPY api/ .
COPY shared/ ./shared/

# Generate Prisma Client
RUN npx prisma generate

ENV NODE_ENV=development

# Create logs directory
RUN mkdir -p logs

EXPOSE 4000 4001

# Health check for development
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["npm", "run", "dev"]

# ---- Production runtime stage ----
FROM node:20-bookworm-slim AS prod
WORKDIR /app

ENV NODE_ENV=production

# Install runtime dependencies and create user for security
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 apiuser

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/shared ./shared

# Create directories with proper permissions
RUN mkdir -p logs uploads \
  && chown -R apiuser:nodejs logs uploads \
  && touch .env

USER apiuser
EXPOSE 4000 4001

# Health check with improved timing for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "dist/server.js"]