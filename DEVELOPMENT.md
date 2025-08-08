# Whisnap Development Guide

## Quick Start

### Local Development Setup

1. **Clone and setup:**
```bash
git clone <repo-url>
cd whisnap-web
```

2. **Start local development environment:**
```bash
# Load dev environment variables and start
export $(grep -v '^#' .env.dev | xargs) && docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up --build
```

3. **Access your local application:**
- **Web App:** http://localhost:3000
- **API:** http://localhost:4000  
- **WebSocket:** ws://localhost:4001
- **Database:** localhost:5433 (whisnap_dev/whisnap_dev/whisnap_dev)

### Development Commands

```bash
# Start local dev 
export $(grep -v '^#' .env.dev | xargs) && docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up --build

# View logs
export $(grep -v '^#' .env.dev | xargs) && docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs -f

# Run database migrations locally
export $(grep -v '^#' .env.dev | xargs) && docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml exec web npx prisma migrate dev

# Access database
export $(grep -v '^#' .env.dev | xargs) && docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml exec postgres psql -U whisnap_dev -d whisnap_dev

# Stop and cleanup
export $(grep -v '^#' .env.dev | xargs) && docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down
```

## Deployment

### Production Environment (Blue-Green)

**Access:** https://whisnap.com

**Deploy to production:**
```bash
# Automatically triggers on push to 'main' branch
git push origin main
```

**Manual blue-green deployment:**
```bash
# On server
ssh whisnap
cd /root/whisnap-prod

# Execute blue-green deployment
./scripts/deploy-blue-green.sh production

# Check current active color
readlink /etc/nginx/upstreams/current.conf

# Force specific color (if needed)
./scripts/deploy-blue-green.sh production --force-blue
./scripts/deploy-blue-green.sh production --force-green
```

## Architecture Overview

### Container Structure
```
┌─────────────────┐    ┌─────────────────┐
│      nginx      │    │   Local Dev     │
│   (Production)  │    │                 │
└─────┬───────────┘    └─────┬───────────┘
      │                      │
┌─────▼───────────┐    ┌─────▼───────────┐
│  web-blue/green │    │      web        │
│  (Next.js)      │    │   (Next.js)     │
└─────┬───────────┘    └─────┬───────────┘
      │                      │
┌─────▼───────────┐    ┌─────▼───────────┐
│ api-blue/green  │    │      api        │
│   (Express)     │    │   (Express)     │
└─────┬───────────┘    └─────┬───────────┘
      │                      │
┌─────▼───────────┐    ┌─────▼───────────┐
│   postgres      │    │   postgres      │
│  (Production)   │    │     (Dev)       │
└─────────────────┘    └─────────────────┘
```

### Blue-Green Deployment Flow

1. **Current State:** Blue is active, serving traffic
2. **Deployment:** Start Green with new code
3. **Health Check:** Verify Green is healthy  
4. **Migration:** Run database migrations (if needed)
5. **Switch:** Update nginx upstream from Blue → Green
6. **Cleanup:** Stop Blue containers
7. **Complete:** Green is now active

### Network Architecture

```
┌─────────────────┐
│  edge (network) │  ← External Docker network
└─────┬───────────┘
      │
┌─────▼───────────┐
│     nginx       │  ← Load balancer/reverse proxy
└─────┬───────────┘
      │
┌─────▼───────────┐
│ whisnap-network │  ← Internal app network
│  ┌───────────┐  │
│  │   web     │  │  ← Next.js (port 3000)
│  │   api     │  │  ← Express (port 4000)  
│  │   ws      │  │  ← WebSocket (port 4001)
│  │ postgres  │  │  ← Database (port 5432)
│  └───────────┘  │
└─────────────────┘
```

## Environment Configuration

### Local (.env.dev)
- Database: `whisnap_dev`
- URL: `http://localhost:3000`
- Port: `5433` (to avoid conflicts)
- Dev dependencies included
- Debug mode enabled

### Production (.env.prod)
- Database: `whisnap_prod`
- URL: `https://whisnap.com`
- Blue-green deployment
- Zero-downtime updates

## SSH Access

**Connect to server:**
```bash
ssh whisnap  # Uses SSH config alias
# NOT: ssh root@195.35.56.159
```

**Common server tasks:**
```bash
# Check running containers
docker ps

# View logs
docker logs <container-name>

# Check nginx status
sudo nginx -t
sudo systemctl status nginx

# View active upstream
readlink /etc/nginx/upstreams/current.conf

# Manual nginx reload
sudo systemctl reload nginx
```

## Database Management

### Migrations

**Local development:**
```bash
# Create new migration
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml exec web npx prisma migrate dev --name add_new_feature

# Reset database (destructive)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml exec web npx prisma migrate reset
```

**Production:**
```bash
# Migrations run automatically during deployment
# Manual migration (if needed):
docker compose -f infra/docker-compose.yml exec web npx prisma migrate deploy
```

### Database Access

**Local:**
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml exec postgres psql -U whisnap_dev -d whisnap_dev
```

**Production:**
```bash
ssh whisnap
docker compose -f infra/docker-compose.yml exec postgres psql -U whisnap_prod_user -d whisnap_prod
```

## Troubleshooting

### Common Issues

**"Port already in use"**
```bash
# Stop all compose services
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down

# Check for stray containers
docker ps -a
```

**"502 Bad Gateway"**
```bash
# Usually nginx can't reach containers
sudo systemctl restart nginx

# Or restart containers
docker compose restart
```

**"JWT token invalid"**
- Check JWT_SECRET matches between web and api containers
- Verify NEXTAUTH_SECRET is set correctly

**Staging/Production deploy fails**
- Check GitHub Actions logs
- Verify secrets are set in GitHub repository
- SSH into server and check container logs

### Health Check Commands

**Local:**
```bash
# Test API
curl http://localhost:4000/v1/health

# Test Web
curl http://localhost:3000/api/health

# Test WebSocket
wscat -c ws://localhost:4001
```

**Production:**
```bash
ssh whisnap

# Test through nginx
curl -H "Host: whisnap.com" http://localhost/
curl -H "Host: whisnap.com" http://localhost/api/v1/health

# Direct container access
curl http://web-blue:3000/api/health
curl http://api-blue:4000/v1/health
```

## File Structure

```
whisnap-web/
├── app/                    # Next.js app directory
├── api/                    # Express API source
├── libs/                   # Shared libraries
├── prisma/                 # Database schema & migrations
├── infra/                  # Infrastructure configuration
│   ├── docker-compose.yml     # Base compose file
│   ├── docker-compose.dev.yml # Local development
│   ├── docker-compose.staging.yml # Staging overrides
│   ├── blue.yml               # Blue deployment
│   ├── green.yml              # Green deployment
│   └── nginx/                 # Nginx configurations
├── scripts/                # Deployment scripts
│   └── deploy-blue-green.sh   # Blue-green deployment
├── .github/workflows/      # CI/CD pipelines
│   ├── deploy-staging.yml     # Staging deployment
│   └── deploy-production.yml  # Production deployment
└── DEVELOPMENT.md          # This file
```

## GitHub Environments & Secrets

### Repository Secrets (Shared)
- `VPS_USER`: SSH username (root)
- `VPS_HOST`: Server IP (195.35.56.159)  
- `VPS_SSH_KEY`: Private SSH key
- `VPS_KNOWN_HOSTS`: SSH known hosts

### Environment-Specific Secrets

**Staging Environment:**
- Same secrets as production but can use test values
- Separate database credentials recommended

**Production Environment:**
- All production secrets (database, APIs, etc.)
- Requires manual approval for deployments (optional)

### Adding New Secrets

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add to "Repository secrets" for shared secrets
3. Add to specific environment for environment-specific secrets

## Tips & Best Practices

- **Always test locally first** before pushing to staging
- **Use staging environment** for testing production-like deployments
- **Monitor logs** during deployments: `docker logs -f <container>`
- **Database migrations** should be backward-compatible for zero-downtime
- **Keep secrets secure** - never commit them to the repository
- **Use blue-green deployment** for production to ensure zero-downtime
- **SSH alias** is configured: use `ssh whisnap` not the full IP address