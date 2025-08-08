#!/bin/bash
set -e

# Blue-Green Deployment Script
# Usage: ./deploy-blue-green.sh [environment] [--force-color]

ENVIRONMENT=${1:-production}
FORCE_COLOR=$2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌${NC} $1"
    exit 1
}

# Configuration
COMPOSE_FILES="-f infra/docker-compose.yml --env-file .env.prod"
PROJECT_NAME="whisnap"

if [[ "$ENVIRONMENT" == "staging" ]]; then
    COMPOSE_FILES="-f infra/docker-compose.yml -f infra/docker-compose.staging.yml --env-file .env.staging"
    PROJECT_NAME="whisnap-stg"
    log "Deploying to STAGING environment"
else
    log "Deploying to PRODUCTION environment"
fi

# Determine current and target colors
get_current_color() {
    local live_container=$(docker ps --format '{{.Names}}' | grep -E '^web-(blue|green)$' || true)
    if [[ "$live_container" =~ web-(blue|green) ]]; then
        echo "${BASH_REMATCH[1]}"
    else
        echo "blue"  # default if first deploy
    fi
}

CURRENT_COLOR=$(get_current_color)
if [[ "$FORCE_COLOR" == "--force-blue" ]]; then
    TARGET_COLOR="blue"
elif [[ "$FORCE_COLOR" == "--force-green" ]]; then
    TARGET_COLOR="green"
elif [[ "$CURRENT_COLOR" == "blue" ]]; then
    TARGET_COLOR="green"
elif [[ "$CURRENT_COLOR" == "green" ]]; then
    TARGET_COLOR="blue"
else
    # First deployment, default to blue
    TARGET_COLOR="blue"
fi

log "Current active color: ${CURRENT_COLOR}"
log "Deploying to: ${TARGET_COLOR}"

# Step 1: Create external network if it doesn't exist
log "Creating external network 'edge' if it doesn't exist..."
docker network create edge 2>/dev/null || log_warn "Network 'edge' already exists"

# Step 2: Build and start the target color
log "Building and starting ${TARGET_COLOR} stack..."
COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
docker compose $COMPOSE_FILES -f "infra/${TARGET_COLOR}.yml" up -d --build --wait

if [[ $? -ne 0 ]]; then
    log_error "Failed to start ${TARGET_COLOR} stack"
fi

log_success "${TARGET_COLOR} stack is running"

# Step 3: Health check
log "Performing health checks..."
TARGET_WEB_CONTAINER="web-${TARGET_COLOR}"
TARGET_API_CONTAINER="api-${TARGET_COLOR}"

# Wait for containers to be healthy
for i in {1..30}; do
    WEB_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $TARGET_WEB_CONTAINER 2>/dev/null || echo "no-health-check")
    API_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $TARGET_API_CONTAINER 2>/dev/null || echo "no-health-check")
    
    if [[ "$WEB_STATUS" == "healthy" || "$WEB_STATUS" == "no-health-check" ]] && \
       [[ "$API_STATUS" == "healthy" || "$API_STATUS" == "no-health-check" ]]; then
        log_success "Health checks passed"
        break
    fi
    
    if [[ $i -eq 30 ]]; then
        log_error "Health checks failed after 30 attempts"
    fi
    
    log "Waiting for health checks... (${i}/30)"
    sleep 2
done

# Step 4: Run database migrations (only for production)
if [[ "$ENVIRONMENT" == "production" ]]; then
    log "Running database migrations..."
    COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
    docker compose $COMPOSE_FILES -f "infra/${TARGET_COLOR}.yml" exec -T -u root web npx prisma migrate deploy
    
    if [[ $? -ne 0 ]]; then
        log_error "Database migration failed"
    fi
    
    log_success "Database migrations completed"
fi

# Step 5: Switch network aliases (zero-downtime flip)
log "Switching network aliases to ${TARGET_COLOR}..."

# Attach NEW containers to edge network with stable aliases
log "Attaching ${TARGET_COLOR} containers with stable aliases..."
docker network connect --alias current-web edge "web-${TARGET_COLOR}" 2>/dev/null || log_warn "web-${TARGET_COLOR} already connected"
docker network connect --alias current-api edge "api-${TARGET_COLOR}" 2>/dev/null || log_warn "api-${TARGET_COLOR} already connected"  
docker network connect --alias current-ws edge "api-${TARGET_COLOR}" 2>/dev/null || log_warn "api-${TARGET_COLOR} WS already connected"

# Detach OLD containers from edge network (removes their aliases)
if [[ "$CURRENT_COLOR" != "$TARGET_COLOR" ]] && docker ps --format '{{.Names}}' | grep -q "^web-${CURRENT_COLOR}$"; then
    log "Removing ${CURRENT_COLOR} containers from edge network..."
    docker network disconnect edge "web-${CURRENT_COLOR}" 2>/dev/null || log_warn "web-${CURRENT_COLOR} already disconnected"
    docker network disconnect edge "api-${CURRENT_COLOR}" 2>/dev/null || log_warn "api-${CURRENT_COLOR} already disconnected"
fi

log_success "Network aliases switched to ${TARGET_COLOR}"

# Step 6: Health check through nginx (should route to new color via current-* aliases)
log "Testing health through nginx after alias switch..."
curl -fsS --max-time 10 -H "Host: whisnap.com" http://localhost/api/health >/dev/null 2>&1 || log_error "Web health check failed"
curl -fsS --max-time 10 -H "Host: whisnap.com" http://localhost/api/v1/health >/dev/null 2>&1 || log_error "API health check failed"

log_success "Health checks passed after alias switch"

# Step 7: Stop the old color (if it exists and is different)
if [[ "$CURRENT_COLOR" != "none" && "$CURRENT_COLOR" != "$TARGET_COLOR" && "$CURRENT_COLOR" != "unknown" ]]; then
    log "Stopping old ${CURRENT_COLOR} stack..."
    COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${CURRENT_COLOR}" \
    docker compose $COMPOSE_FILES -f "infra/${CURRENT_COLOR}.yml" down
    
    log_success "Old ${CURRENT_COLOR} stack stopped"
else
    log_warn "No old stack to stop (current: ${CURRENT_COLOR})"
fi

# Step 8: Cleanup unused images
log "Cleaning up unused Docker images..."
docker image prune -f

log_success "🎉 Deployment complete! Active color: ${TARGET_COLOR}"
log "You can verify the deployment at: https://whisnap.com"

# Optional: Show running containers
log "Current running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(web-|api-|whisnap)"