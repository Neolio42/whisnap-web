#!/bin/bash
# =============================================================================
# Streamlined Blue-Green Deployment Script (2025 Edition)
# Usage: ./deploy-blue-green-v2.sh [environment] [--force-color]
# =============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

# Trap errors with line numbers for better debugging
trap 'echo "[ERROR] Line $LINENO failed"; exit 1' ERR

# Environment and configuration
ENVIRONMENT=${1:-production}
FORCE_COLOR=$2
IMAGE_TAG=${IMAGE_TAG:?IMAGE_TAG environment variable required}
GHCR_READ_TOKEN=${GHCR_READ_TOKEN:?GHCR_READ_TOKEN environment variable required}
GITHUB_ACTOR=${GITHUB_ACTOR:?GITHUB_ACTOR environment variable required}

# Colors and logging
log() { echo -e "\033[0;34m[$(date +'%F %T')]\033[0m $*"; }
log_success() { echo -e "\033[0;32m[$(date +'%F %T')] ✅\033[0m $*"; }
log_warn() { echo -e "\033[1;33m[$(date +'%F %T')] ⚠️\033[0m $*"; }
log_error() { echo -e "\033[0;31m[$(date +'%F %T')] ❌\033[0m $*"; exit 1; }

# Project configuration
PROJECT_NAME="whisnap"
COLOR_FILE="/var/run/whisnap-color"
ENV_FILE=".env.prod"

if [[ "$ENVIRONMENT" == "staging" ]]; then
    PROJECT_NAME="whisnap-stg"
    ENV_FILE=".env.staging"
    log "Deploying to STAGING environment"
else
    log "Deploying to PRODUCTION environment"
fi

# Validate environment file exists
[[ -f "$ENV_FILE" ]] || log_error "Environment file $ENV_FILE not found"

COMPOSE_FILES="-f infra/docker-compose.yml --env-file $ENV_FILE"

log "Using image tag: ${IMAGE_TAG}"

# Determine colors (simplified logic)
CURRENT_COLOR=$(cat "$COLOR_FILE" 2>/dev/null || echo "blue")
if [[ "$FORCE_COLOR" == "--force-blue" ]]; then
    TARGET_COLOR="blue"
elif [[ "$FORCE_COLOR" == "--force-green" ]]; then
    TARGET_COLOR="green"
else
    TARGET_COLOR=$( [ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue" )
fi

log "Current: ${CURRENT_COLOR} → Target: ${TARGET_COLOR}"

# Setup networks (idempotent)
log "Setting up networks..."
docker network create edge 2>/dev/null || log_warn "Network 'edge' exists"
docker network create whisnap-network 2>/dev/null || log_warn "Network 'whisnap-network' exists"

# Start shared services
log "Starting shared PostgreSQL..."
if ! docker ps --format '{{.Names}}' | grep -q "postgres-shared"; then
    COMPOSE_PROJECT_NAME="postgres-shared" \
    docker compose -f infra/postgres-shared.yml --env-file .env.prod up -d --wait postgres
    log_success "PostgreSQL started"
else
    log_warn "PostgreSQL already running"
fi

# GHCR Authentication (2025 fix: use PAT instead of GITHUB_TOKEN)
log "Authenticating with GHCR..."
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin >/dev/null 2>&1 || log_warn "GHCR login skipped"

# Pull and start target stack (2025 improvement: use --wait)
log "Starting ${TARGET_COLOR} stack..."
export COLOR="$TARGET_COLOR"
COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
docker compose $COMPOSE_FILES pull web api

COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
docker compose $COMPOSE_FILES up -d --wait web api

log_success "${TARGET_COLOR} stack ready"

# Database migrations (production only)
if [[ "$ENVIRONMENT" == "production" ]]; then
    log "Running database migrations..."
    COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
    docker compose $COMPOSE_FILES exec -T -e HOME=/app api \
        bash -c 'psql $DATABASE_URL -c "SET lock_timeout = '\'2s\''; SET statement_timeout = '\'60s\''"' || true
    
    COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
    docker compose $COMPOSE_FILES exec -T -e HOME=/app api npx prisma migrate deploy
    
    log_success "Migrations completed"
fi

# Switch nginx via template rendering (2025 improvement)
log "Switching nginx to ${TARGET_COLOR}..."
UPSTREAM_PREFIX="${PROJECT_NAME}-${TARGET_COLOR}"

# Validate template file exists
[[ -f "infra/nginx/nginx.conf.tmpl" ]] || log_error "Nginx template file infra/nginx/nginx.conf.tmpl not found"

# Render nginx template with validation
env UPSTREAM_PREFIX="$UPSTREAM_PREFIX" \
envsubst '${UPSTREAM_PREFIX}' < infra/nginx/nginx.conf.tmpl > infra/nginx/nginx.conf.tmp

# Validate template rendering succeeded
[[ -s infra/nginx/nginx.conf.tmp ]] || log_error "Template rendering failed - output file is empty"

# Atomically move rendered config into place
mv infra/nginx/nginx.conf.tmp infra/nginx/nginx.conf

# Update nginx container
COMPOSE_PROJECT_NAME="nginx-proxy" \
docker compose -f infra/nginx-proxy.yml up -d nginx

# Test and reload nginx
if docker exec nginx-proxy-nginx-1 nginx -t; then
    docker exec nginx-proxy-nginx-1 nginx -s reload || docker restart nginx-proxy-nginx-1
    log_success "Nginx switched to ${TARGET_COLOR}"
else
    log_error "Nginx configuration test failed"
fi

# Health check through nginx (keep this for safety)
log "Validating health through nginx..."
for i in {1..10}; do
    if docker exec nginx-proxy-nginx-1 curl -fsS -H "Host: whisnap.com" http://localhost/ >/dev/null 2>&1 && \
       docker exec nginx-proxy-nginx-1 curl -fsS -H "Host: whisnap.com" http://localhost/api/v1/health >/dev/null 2>&1; then
        log_success "Health checks passed"
        break
    fi
    
    if [[ $i -eq 10 ]]; then
        # Rollback on failure
        if [[ -n "$CURRENT_COLOR" && "$CURRENT_COLOR" != "$TARGET_COLOR" ]]; then
            log "Rolling back to ${CURRENT_COLOR}..."
            env UPSTREAM_PREFIX="${PROJECT_NAME}-${CURRENT_COLOR}" \
            envsubst '${UPSTREAM_PREFIX}' < infra/nginx/nginx.conf.tmpl > infra/nginx/nginx.conf
            docker exec nginx-proxy-nginx-1 nginx -s reload
            
            COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
            docker compose $COMPOSE_FILES down
            
            log_error "Deployment failed, rolled back to ${CURRENT_COLOR}"
        else
            log_error "Health checks failed and no rollback target available"
        fi
    fi
    
    log "Retry ${i}/10..."
    sleep 2
done

# Stop old stack and finalize
if [[ -n "$CURRENT_COLOR" && "$CURRENT_COLOR" != "$TARGET_COLOR" ]]; then
    log "Stopping old ${CURRENT_COLOR} stack..."
    COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${CURRENT_COLOR}" \
    docker compose $COMPOSE_FILES down
    log_success "Old stack stopped"
fi

# Update color tracking
echo "$TARGET_COLOR" | sudo tee "$COLOR_FILE" >/dev/null 2>&1 || echo "$TARGET_COLOR" > "$COLOR_FILE"

# Cleanup (conservative - keep recent images for rollback)
log "Cleaning up resources..."
docker image prune -f >/dev/null 2>&1 || true

# Success summary
log_success "🎉 Deployment complete!"
log "Active color: ${TARGET_COLOR} (tag: ${IMAGE_TAG})"
log "Application: https://whisnap.com"

# Show running containers
log "Active containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep -E "(web-|api-|nginx)" | head -10 || true