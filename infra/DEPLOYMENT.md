# Whisnap Deployment Guide

## Repository Structure

```
whisnap-web/
├── api/                  # Express API backend
│   ├── src/             # API source code
│   ├── Dockerfile       # API container definition
│   └── package.json     # API dependencies
├── app/                  # Next.js frontend
├── shared/              # Shared TypeScript types
├── infra/               # Infrastructure configuration
│   ├── docker-compose.yml  # Production Docker setup
│   └── nginx/           # Nginx configuration
│       ├── Dockerfile   # Nginx container
│       ├── default.conf # Nginx config
│       └── ssl/         # SSL certificates
└── .github/
    └── workflows/
        └── deploy.yml   # Automated deployment

```

## Automated Deployment (GitHub Actions)

Deployment happens automatically when you push to the `main` branch:

1. **Push to main** → GitHub Actions triggers
2. **Files sync** → Code is copied to VPS via rsync
3. **Environment setup** → Secrets are injected from GitHub
4. **Build & Deploy** → Docker containers are built and started
5. **Health checks** → Services are verified before marking success

## Manual Deployment (Emergency/Testing)

If GitHub Actions fails or you need to deploy manually:

### SSH to the server
```bash
ssh root@195.35.56.159
```

### Navigate to the deployment directory
```bash
cd /root/whisnap-live
```

### Build and deploy
```bash
# Stop existing containers
docker compose -f infra/docker-compose.yml down

# Build new containers
docker compose -f infra/docker-compose.yml build

# Start services
docker compose -f infra/docker-compose.yml up -d

# Check status
docker compose -f infra/docker-compose.yml ps
```

### View logs
```bash
# All services
docker compose -f infra/docker-compose.yml logs

# Specific service
docker compose -f infra/docker-compose.yml logs api
docker compose -f infra/docker-compose.yml logs web
docker compose -f infra/docker-compose.yml logs nginx
```

## Health Checks

The application has health endpoints:
- **Web**: http://localhost:3000/api/health
- **API**: http://localhost:4000/v1/health

## Troubleshooting

### API container unhealthy but running
This is usually just the health check failing due to missing dependencies. If the API is responding on port 4000, it's working.

### Nginx not starting
Check if nginx.conf exists and is a file (not a directory):
```bash
ls -la infra/nginx/
# Should show default.conf as a file
```

### Database connection issues
Ensure the database is running and migrations are applied:
```bash
docker compose -f infra/docker-compose.yml exec web npx prisma migrate deploy
```

## Environment Variables

Production environment variables are stored as GitHub Secrets and injected during deployment. Never commit `.env.prod` to the repository.

Key variables:
- `DATABASE_PASSWORD`
- `JWT_SECRET`
- `NEXTAUTH_SECRET`
- `STRIPE_SECRET_KEY`
- API provider keys (OpenAI, Anthropic, etc.)

## SSL Certificates

SSL certificates are stored in `infra/nginx/ssl/`:
- `fullchain.pem` - Certificate chain
- `privkey.pem` - Private key

These should be updated when certificates expire.