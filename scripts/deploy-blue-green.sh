#!/bin/bash
set -e

# Blue-Green Deployment Script with proper image versioning
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

# Validate required environment variables
if [[ -z "$IMAGE_TAG" ]]; then
    log_error "IMAGE_TAG environment variable is required"
fi

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

log "Using image tag: ${IMAGE_TAG}"

# Determine current and target colors
get_current_color() {
    # Check which upstream is currently active via nginx container
    local current_upstream=$(docker exec nginx readlink -f /etc/nginx/upstreams/current.conf 2>/dev/null | grep -oE '(blue|green)' || echo "")
    if [[ -n "$current_upstream" ]]; then
        echo "$current_upstream"
    else
        # Fallback: check running containers
        local live_container=$(docker ps --format '{{.Names}}' | grep -E '^web-(blue|green)$' || true)
        if [[ "$live_container" =~ web-(blue|green) ]]; then
            echo "${BASH_REMATCH[1]}"
        else
            echo "blue"  # default if first deploy
        fi
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

# Step 1: Create external network and start nginx if it doesn't exist
log "Creating external network 'edge' if it doesn't exist..."
docker network create edge 2>/dev/null || log_warn "Network 'edge' already exists"
docker network create whisnap-network 2>/dev/null || log_warn "Network 'whisnap-network' already exists"

# Start nginx if it's not running (separate from blue/green stacks)
if ! docker ps --format '{{.Names}}' | grep -q '^nginx$'; then
    log "Starting nginx proxy..."
    COMPOSE_PROJECT_NAME="whisnap-proxy" \
    docker compose $COMPOSE_FILES up -d nginx
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to start nginx proxy"
    fi
    
    log_success "Nginx proxy is running"
fi

# Step 2: Login to GHCR (in case not already logged in)
log "Ensuring Docker is logged into GHCR..."
echo $GITHUB_TOKEN | docker login ghcr.io -u $(echo $GITHUB_ACTOR) --password-stdin 2>/dev/null || log_warn "GHCR login skipped (may already be logged in)"

# Step 3: Pull images for the target stack
log "Pulling images for ${TARGET_COLOR} stack..."
export IMAGE_TAG
COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
docker compose $COMPOSE_FILES -f "infra/${TARGET_COLOR}.yml" pull web api

if [[ $? -ne 0 ]]; then
    log_error "Failed to pull images for ${TARGET_COLOR} stack"
fi

# Step 4: Start the target color stack
log "Starting ${TARGET_COLOR} stack..."
COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
docker compose $COMPOSE_FILES -f "infra/${TARGET_COLOR}.yml" up -d --wait web api

if [[ $? -ne 0 ]]; then
    log_error "Failed to start ${TARGET_COLOR} stack"
fi

log_success "${TARGET_COLOR} stack is running"

# Step 5: Wait for health checks
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
    
    log "Waiting for health checks... (${i}/30) [Web: ${WEB_STATUS}, API: ${API_STATUS}]"
    sleep 2
done

# Step 6: Run database migrations (only for production)
if [[ "$ENVIRONMENT" == "production" ]]; then
    log "Running database migrations..."
    COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${TARGET_COLOR}" \
    docker compose $COMPOSE_FILES -f "infra/${TARGET_COLOR}.yml" exec -T -e HOME=/app api npx prisma migrate deploy
    
    if [[ $? -ne 0 ]]; then
        log_error "Database migration failed"
    fi
    
    log_success "Database migrations completed"
fi

# Step 7: Switch nginx upstream inside the container
log "Switching nginx upstream to ${TARGET_COLOR}..."

# Switch the symlink inside the nginx container
NGINX_CONTAINER=$(docker ps --format '{{.Names}}' | grep nginx | head -1)
if [[ -z "$NGINX_CONTAINER" ]]; then
    log_error "Nginx container not found"
fi

docker exec $NGINX_CONTAINER ln -sf /etc/nginx/upstreams/${TARGET_COLOR}.conf /etc/nginx/upstreams/current.conf

if [[ $? -ne 0 ]]; then
    log_error "Failed to switch nginx upstream"
fi

# Test nginx config and reload
log "Testing nginx configuration and reloading..."
docker exec $NGINX_CONTAINER nginx -t && docker exec $NGINX_CONTAINER nginx -s reload

if [[ $? -ne 0 ]]; then
    log_error "Nginx reload failed"
fi

log_success "Nginx switched to ${TARGET_COLOR} upstream"

# Step 8: Health check through nginx (should route to new color)
log "Testing health through nginx after upstream switch..."
for i in {1..10}; do
    if docker exec $NGINX_CONTAINER curl -fsS --max-time 10 -H "Host: whisnap.com" http://localhost/ >/dev/null 2>&1 && \
       docker exec $NGINX_CONTAINER curl -fsS --max-time 10 -H "Host: whisnap.com" http://localhost/api/v1/health >/dev/null 2>&1; then
        log_success "Health checks passed after upstream switch"
        break
    fi
    
    if [[ $i -eq 10 ]]; then
        log_error "Health checks failed after upstream switch"
    fi
    
    log "Retrying health check... (${i}/10)"
    sleep 2
done

# Step 9: Stop the old color (if it exists and is different)
if [[ "$CURRENT_COLOR" != "none" && "$CURRENT_COLOR" != "$TARGET_COLOR" && "$CURRENT_COLOR" != "unknown" && -n "$CURRENT_COLOR" ]]; then
    log "Stopping old ${CURRENT_COLOR} stack..."
    COMPOSE_PROJECT_NAME="${PROJECT_NAME}-${CURRENT_COLOR}" \
    docker compose $COMPOSE_FILES -f "infra/${CURRENT_COLOR}.yml" down
    
    log_success "Old ${CURRENT_COLOR} stack stopped"
else
    log_warn "No old stack to stop (current: ${CURRENT_COLOR})"
fi

# Step 10: Cleanup old images (but keep recent ones for rollback)
log "Cleaning up old Docker images (keeping recent tags)..."
# Only remove untagged/dangling images, not tagged ones
docker image prune -f

log_success "🎉 Deployment complete! Active color: ${TARGET_COLOR}"
log "Image tag deployed: ${IMAGE_TAG}"
log "You can verify the deployment at: https://whisnap.com"

# Show running containers
log "Current running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep -E "(web-|api-|nginx)" | head -10