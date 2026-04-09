# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup

```bash
# Copy template and fill in production values
cp .env.template .env.production
```

Required values:
- `OPENAI_API_KEY` with quota for production usage
- Firebase service account with Firestore enabled
- Production database URL (managed PostgreSQL)
- Production frontend/API URLs

### 2. Database Preparation

```bash
# Create production database
createdb listing_db_prod

# Run migrations
npx prisma migrate deploy --environment-name production

# Seed initial data if needed
npx prisma db seed
```

### 3. Build All Services

```bash
# Build with production config
docker-compose -f docker-compose.prod.yml build

# Or build individually:
npm run build
cd mcp-server && npm run build && cd ..
cd agent-backend && npm run build && cd ..
cd web-frontend && npm run build && cd ..
```

## Deployment Options

### Option A: Docker Compose (Recommended)

```bash
# Pull latest code
git pull origin main

# Build images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# View running containers
docker ps
```

### Option B: Kubernetes

```yaml
# Create listing-namespace
apiVersion: v1
kind: Namespace
metadata:
  name: listing

---
# Deployment for each service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: listing
spec:
  replicas: 3  # Scale horizontally
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: listing-api:latest
        ports:
        - containerPort: 4000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: listing-secrets
              key: database-url
        - name: NODE_ENV
          value: production
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 5
```

### Option C: Cloud Platforms

#### Google Cloud Run

```bash
# Deploy Agent Backend
gcloud run deploy listing-agent \
  --source ./agent-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY

# Deploy Frontend
gcloud run deploy listing-frontend \
  --source ./web-frontend \
  --platform managed \
  --region us-central1
```

#### AWS ECS

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name listing-prod

# Register container definitions
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster listing-prod \
  --service-name listing-api \
  --task-definition listing-api
```

#### Vercel (Frontend only)

```bash
# Connect repository
vercel link

# Deploy frontend
cd web-frontend
vercel --prod
```

#### Heroku (for small scale)

```bash
# Create apps
heroku create listing-api
heroku create listing-agent
heroku create listing-mcp

# Set config
heroku config:set -a listing-agent OPENAI_API_KEY=sk-...

# Deploy
git push heroku main
```

## Post-Deployment

### 1. Verify Services

```bash
# Check all endpoints responding
curl https://api.example.com/health
curl https://agent.example.com/health
curl https://mcp.example.com/health
curl https://app.example.com

# Check logs
docker-compose logs api
docker-compose logs agent-backend
```

### 2. Database Verification

```bash
# Connect to production database
psql $DATABASE_URL

# Check migrations applied
SELECT * FROM _prisma_migrations;

# Verify tables exist
\dt
```

### 3. Firestore Setup

```bash
# Create Firestore database
gcloud firestore databases create --region us-central1

# Set security rules
gcloud firestore rules publish firestore.rules
```

## Monitoring & Maintenance

### Set up Logging

```bash
# Export logs to Cloud Logging
docker-compose logs -f --timestamps | 
  tee >(curl -H "Content-Type: application/json" \
        -d @- https://logging.googleapis.com/logging/v2/entries:write)
```

### Monitor Key Metrics

- API response time: < 200ms
- LLM latency: < 5s
- WebSocket connection success rate: > 99%
- Firestore read/write errors: 0

### Automated Backups

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz

# Firestore backup
gcloud firestore export gs://backup-bucket/
```

## Scaling Considerations

### Horizontal Scaling

```yaml
# Docker Compose: Scale services
docker-compose up -d --scale api=3 --scale agent-backend=2
```

### Database Scaling

- Upgrade to managed PostgreSQL (RDS, Cloud SQL)
- Enable read replicas for high-traffic scenarios
- Use connection pooling (PgBouncer)

### Cache Layer

```typescript
// Add Redis for session caching
import redis from 'redis';
const client = redis.createClient({
  url: process.env.REDIS_URL
});

// Cache LLM responses
const cacheKey = `llm:${userMessage}`;
const cached = await client.get(cacheKey);
```

### CDN Configuration

```nginx
# Nginx reverse proxy with caching
upstream api {
  server api:4000;
}

server {
  listen 80;
  server_name api.example.com;
  
  location ~ \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
    proxy_pass http://api;
    proxy_cache_valid 200 60d;
    add_header Cache-Control "public, immutable";
  }
  
  location / {
    proxy_pass http://api;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Rollback Procedure

```bash
# Keep previous image versions
docker image ls

# Rollback to previous version
docker-compose down
git revert HEAD
docker-compose up -d
```

## Security Checklist

- [ ] HTTPS enabled (SSL certificates)
- [ ] API keys stored in .env, never in code
- [ ] Firebase security rules configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection in frontend
- [ ] CSRF tokens if needed
- [ ] Database encryption at rest
- [ ] Regular security audits
- [ ] Secrets rotation policy

## Troubleshooting Production Issues

### High Latency

```bash
# Check database connection pool
SELECT count(*) FROM pg_stat_activity;

# Check slow queries
SET log_min_duration_statement = 1000;
```

### Memory Leaks

```bash
# Check Node.js memory usage
watch -n 1 'docker stats | grep agent-backend'

# Heap snapshot
node --heap-expose-gc src/index.js
```

### WebSocket Disconnections

```typescript
// Increase heartbeat interval
io.engine.pingInterval = 30000;  // 30s
io.engine.pingTimeout = 60000;   // 60s
```

---

**Questions?** Contact DevOps team or check logs for detailed error information.
