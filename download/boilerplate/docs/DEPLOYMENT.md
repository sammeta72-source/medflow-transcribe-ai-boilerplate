# MedFlow Transcribe AI — Deployment Guide

## Option 1: Vercel (Frontend) + Render (FastAPI Backend)

### Frontend (Vercel)
```bash
# 1. Push to GitHub
git add . && git commit -m "MedFlow Transcribe AI" && git push origin main

# 2. Import to Vercel
# → https://vercel.com/new
# → Select your repo
# → Framework: Next.js
# → Add environment variables from .env.example
# → Deploy
```

### Backend (Render / Railway / Fly.io)
```bash
# 1. Create a Dockerfile for the FastAPI service:
# mini-services/ai-agents-service/Dockerfile:
#   FROM python:3.12-slim
#   WORKDIR /app
#   COPY requirements.txt .
#   RUN pip install -r requirements.txt
#   COPY . .
#   CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# 2. Deploy to Render:
# → https://render.com
# → New → Web Service
# → Connect your repo
# → Root Directory: mini-services/ai-agents-service
# → Build: pip install -r requirements.txt
# → Start: uvicorn main:app --host 0.0.0.0 --port $PORT
# → Add environment variables
```

### Database (Neon / Supabase / Railway Postgres)
```bash
# Use a managed PostgreSQL:
# → Neon: https://neon.tech (free tier, serverless Postgres)
# → Supabase: https://supabase.com (Postgres + auth + storage)
# → Railway: https://railway.app

# Update DATABASE_URL in Vercel env vars:
# DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"

# Run migrations:
bun run db:push
bun run prisma/seed.ts
```

---

## Option 2: Docker Compose (All-in-One)

```bash
# 1. Build + start all services
docker-compose up -d

# 2. Run database migrations
docker-compose exec web bun run db:push
docker-compose exec web bun run prisma/seed.ts

# 3. Access:
# → App: http://localhost:3000
# → FastAPI docs: http://localhost:8000/docs
# → MinIO console: http://localhost:9001
# → PostgreSQL: localhost:5432
```

---

## Option 3: AWS ECS (Production)

### Prerequisites
- AWS account with ECS + RDS + S3 + ElastiCache
- AWS CLI configured

### Steps
```bash
# 1. Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier medflow-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username medflow \
  --master-user-password <password> \
  --allocated-storage 20

# 2. Create S3 bucket for audio storage
aws s3api create-bucket --bucket medflow-audio --region us-east-1

# 3. Create ElastiCache Redis (for background jobs)
aws elasticache create-cache-cluster --cache-cluster-id medflow-redis --cache-node-type cache.t3.micro --engine redis

# 4. Build + push Docker images
aws ecr create-repository --repository-name medflow-web
aws ecr create-repository --repository-name medflow-api

# 5. Create ECS task definitions + services
# (See aws/task-definition-web.json + aws/task-definition-api.json)

# 6. Create Application Load Balancer + target groups
# 7. Configure Auto Scaling (min 2, max 10, target 70% CPU)
```

---

## Option 4: On-Premises (Air-Gapped / Sovereign Cloud)

### For national-security-grade health systems:
```bash
# 1. Use the docker-compose.yml as a base
# 2. Replace cloud services with on-prem equivalents:
#    - PostgreSQL: on-prem PostgreSQL 16
#    - Redis: on-prem Redis 7
#    - Object storage: MinIO (on-prem S3-compatible)
#    - AI models: self-hosted (local Whisper, local LLM)
#    - No external API calls (all processing on-prem)

# 3. Deploy behind your firewall
# 4. Use on-prem HSM for encryption keys (FIPS 140-2 Level 3)
# 5. Configure data residency (no data leaves the network)

# Environment variables for on-prem:
DATABASE_URL="postgresql://medflow:password@db.internal:5432/medflow"
REDIS_URL="redis://redis.internal:6379"
S3_ENDPOINT="http://minio.internal:9000"
ENCRYPTION_KEY="<hsm-managed-key>"
SPEECH_TO_TEXT_PROVIDER="whisper-local"
OPENAI_API_KEY=""  # empty — no external AI calls
```

---

## Production Environment Checklist

- [ ] **DATABASE_URL** set to managed PostgreSQL (not SQLite)
- [ ] **AUTH_SECRET** set to a random 32+ character string
- [ ] **NEXTAUTH_URL** set to your production domain
- [ ] **STRIPE_SECRET_KEY** + webhook secret configured
- [ ] **OPENAI_API_KEY** or **ZAI_API_KEY** for real AI
- [ ] **S3_*  ** variables for object storage (audio files)
- [ ] **ENCRYPTION_KEY** for field-level encryption
- [ ] **SENTRY_DSN** for error tracking
- [ ] **HTTPS** configured (via Vercel automatically, or via Caddy/Nginx)
- [ ] **BAA** signed with your cloud provider
- [ ] **Security Risk Analysis (SRA)** completed (use the built-in SRA tool)
- [ ] **Backup strategy** configured (daily automated + point-in-time recovery)
- [ ] **Monitoring** configured (health checks + alerting)
- [ ] **Rate limiting** enabled (API gateway or Caddy)

---

## Custom Domain + HTTPS

### Via Vercel:
1. Go to Project Settings → Domains
2. Add your domain (e.g., `portal.yourcompany.com`)
3. Add the DNS records Vercel provides
4. HTTPS is automatic (Let's Encrypt)

### Via Caddy (self-hosted):
```Caddyfile
portal.yourcompany.com {
    reverse_proxy localhost:3000
}

# FastAPI (internal, not exposed publicly)
# Access via the XTransformPort proxy mechanism
```

---

## Scaling

| Component | Scaling Strategy |
|-----------|-----------------|
| Next.js | Stateless → horizontal scaling (Vercel auto-scales, or K8s HPA) |
| FastAPI | Stateless → horizontal scaling (multiple workers + load balancer) |
| PostgreSQL | Read replicas for analytics; primary for writes |
| Redis | Cluster mode for high-throughput job queues |
| MinIO/S3 | Distributed mode for large audio storage |
| AI inference | GPU autoscaling group (for self-hosted models) |
