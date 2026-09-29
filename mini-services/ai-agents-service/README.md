# ai-agents-service (FastAPI)

MedFlow Transcribe AI — **AI Agent Orchestration & Multi-Database Connector Service**.

A FastAPI backend mini-service that powers the MedFlow Transcribe AI Medical
Transcription BPO SaaS. It is called by the Next.js frontend (port 3000)
through the Caddy gateway.

## Quick start

```bash
# dev (auto-reload)
bun run dev        # → python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# production
bun run start      # → python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Swagger UI: http://localhost:8000/docs  •  ReDoc: http://localhost:8000/redoc

## How the frontend reaches this service

The Next.js frontend never writes an absolute URL with a port. It uses a
**relative** path with `?XTransformPort=8000`, and Caddy strips the query
and forwards to `localhost:8000`:

```ts
// from src/app/page.tsx or any client component
const res = await fetch('/api/agents?XTransformPort=8000');
```

## Endpoints (all under `/api`)

### Health
- `GET /api/health`

### AI Agents (10)
- `GET /api/agents` — list all 10 agents
- `GET /api/agents/{agent_id}` — full detail (with last 5 runs)
- `POST /api/agents/{agent_id}/run` — simulate a run
- `GET /api/agents/runs?limit=20` — recent runs across all agents

Agents: intake-validation, transcription, structuring, qa, allocation, sla,
delivery, billing, security, reporting.

### Multi-DB connectors
- `GET /api/db/connectors` — SQLite, PostgreSQL, Supabase, MySQL, MongoDB
- `POST /api/db/connectors/test` — validate a connection string
- `POST /api/db/connectors/{connector}/switch` — promote to active backend
- `GET /api/db/schema` — Prisma-equivalent entity catalogue

### FHIR & HL7 export (synthetic data)
- `GET /api/fhir/{job_id}` — FHIR R4 Bundle (DocumentReference + Practitioner + Patient)
- `GET /api/hl7/{job_id}` — HL7 v2.5 `MDM^T02` message (plain text)

### EHR integrations
- `GET /api/integrations` — Epic, Cerner, Allscripts, athena, SFTP, REST, HL7 FHIR, HL7 v2

## Seeded demo jobs

`JOB-2024-001` … `JOB-2024-006` with synthetic patient data (MRN prefix `SYN-`).
These drive the FHIR / HL7 endpoints with realistic content.

## Tech

- Python 3.12
- FastAPI 0.128
- uvicorn 0.44
- pydantic 2.12
- No database in this service — the Next.js app owns Prisma/SQLite. State is
  in-memory module-level variables (capped runs list of 100).
