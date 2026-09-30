# MedFlow Transcribe AI — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                             │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Next.js 16 SPA (port 3000)                                     ││
│  │  ├── 29 sidebar sections (React + Tailwind + shadcn/ui)        ││
│  │  ├── Voice Chatbot (z-ai-web-dev-sdk: LLM + ASR + TTS)        ││
│  │  ├── Voice Ops ("Hey MedFlow" — Web Speech API + TTS)         ││
│  │  ├── RBAC store (Zustand + persist — 12 roles)                ││
│  │  ├── 3-tier fetch fallback (live → embedded → static)         ││
│  │  └── AiDataBootstrap (Server Component — SSR data embedding)  ││
│  └───────────────────────┬─────────────────────────────────────────┘│
└──────────────────────────┼──────────────────────────────────────────┘
                           │ relative fetch
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Caddy Gateway (port 81)                           │
│  ├── /api/*?XTransformPort=8000  →  localhost:8000 (FastAPI)       │
│  └── /* (default)               →  localhost:3000 (Next.js)      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                              ▼
┌──────────────────────┐     ┌──────────────────────────────────────┐
│  Next.js API Routes   │     │  Python FastAPI (port 8000)           │
│  (port 3000)         │     │                                      │
│  ├── /api/medflow/   │     │  ├── 10 AI Agents                     │
│  │   ├── jobs        │     │  │   (intake, transcription,           │
│  │   ├── dashboard   │     │  │    structuring, QA, allocation,    │
│  │   ├── controls    │     │  │    SLA, delivery, billing,         │
│  │   ├── autopilot   │     │  │    security, reporting)            │
│  │   ├── wfm         │     │  │                                    │
│  │   ├── sra         │     │  ├── 5 DB Connectors                  │
│  │   ├── stripe      │     │  │   (SQLite, Postgres, Supabase,     │
│  │   └── ...         │     │  │    MySQL, MongoDB)                  │
│  │                   │     │  │                                    │
│  ├── /api/ai/[...]*  │────▶│  ├── FHIR R4 (DocumentReference)      │
│  │   (catch-all      │     │  ├── HL7 v2.5 (MDM^T02)              │
│  │    proxy → 8000)  │     │  ├── Entity Extraction                │
│  │                   │     │  │   (SNOMED/ICD-10/CPT/RxNorm)      │
│  ├── /api/chat/      │     │  ├── Hallucination Detection          │
│  │   (LLM + ASR +TTS)│     │  ├── Copilot Summary                  │
│  │                   │     │  ├── FHIR Subscriptions               │
│  └── /api/streaming/ │     │  └── DirectTrust Messaging            │
│      (live ASR)      │     │                                      │
└──────────┬───────────┘     └──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Prisma + SQLite (or PostgreSQL)                   │
│  24+ models: Organization, User, TranscriptionJob, JobEvent,       │
│  AuditEvent, ClarificationRequest, Subscription, UsageRecord,     │
│  IntegrationConnection, DeliveryDestination, DataRetentionPolicy  │
└─────────────────────────────────────────────────────────────────────┘
```

## Agent Orchestration Flow

```
Audio Upload → [Intake Validation Agent] → validated?
                                               │
                    ┌──────────────────────────┤
                    ▼                          ▼
              [Transcription Agent]      (reject + log)
                    │
                    ▼
           [Structuring Agent] → structured doc
                    │
                    ▼
              [QA Agent] → risk score + findings
                    │
              ┌─────┴─────┐
              ▼           ▼
        low risk      high risk
              │           │
              ▼           ▼
     [Allocation Agent]  (escalate to QA)
              │
              ▼
        Human Editor → edits
              │
              ▼
        [QA Analyst] → approves?
              │
              ▼
        Provider Review → e-signs
              │
              ▼
        [Delivery Agent] → FHIR/HL7/portal/SFTP
              │
              ▼
        [Billing Agent] → meter usage
              │
              ▼
        [SLA Agent] → monitor throughout
        [Security Agent] → monitor throughout
        [Reporting Agent] → daily/weekly reports
```

## 3-Tier Data Resilience

```
Client fetches /api/ai/agents
         │
         ▼
  ┌─ Tier 1: Live Fetch (fetchAi) ──────────────────────────┐
  │  Try 1: /api/agents?XTransformPort=8000 (gateway)      │
  │  Try 2: /api/ai/agents (Next.js proxy)                 │
  │  Each: 3 attempts, exponential backoff                 │
  └──────────────────────┬─────────────────────────────────┘
                    success?
                    ├─ yes → return live data
                    └─ no  → fall through
                         ▼
  ┌─ Tier 2: Server-Embedded (AiDataBootstrap) ────────────┐
  │  Next.js Server Component fetches localhost:8000        │
  │  during SSR → embeds as window.__MEDFLOW_AI_DATA__      │
  │  Client reads getEmbeddedAiData()                      │
  └──────────────────────┬─────────────────────────────────┘
                    has data?
                    ├─ yes → return embedded data
                    └─ no  → fall through
                         ▼
  ┌─ Tier 3: Static Fallback (in JS bundle) ───────────────┐
  │  Hardcoded in static-data.ts (compiled into bundle)   │
  │  Always available — no fetch/SSR/server needed         │
  │  STATIC_AGENTS, STATIC_DB_CONNECTORS, etc.             │
  └─────────────────────────────────────────────────────────┘
```

## RBAC Architecture

```
useRbac (Zustand + persist)
    │
    ├── role: string (12 roles)
    ├── can(permission): boolean
    ├── canAccessSection(sectionId): boolean
    └── setRole(role): void
         │
         ▼
    AppShell
    ├── navByGroup = NAV_ITEMS.filter(i => rbac.canAccessSection(i.id))
    ├── effectiveUser = { name, role, email } from store
    └── RolesPanel (modal — switch roles + view permission matrix)
         │
         ▼
    Section Components
    └── RoleGate permission="action.provider_approve"
        └── (only renders if can(permission) === true)
```

## File-to-Feature Mapping

| Feature | Frontend | Backend | Data Source |
|---------|----------|---------|-------------|
| Jobs Kanban | `sections/JobsKanban.tsx` | `/api/medflow/jobs` | Prisma TranscriptionJob |
| AI Agents | `sections/AIAgents.tsx` | `/api/ai/agents` (FastAPI) | FastAPI in-memory |
| Auto-Pilot | `sections/AutoPilot.tsx` | `/api/medflow/autopilot` | Prisma + computed |
| Voice Chatbot | `VoiceChatbot.tsx` | `/api/chat/*` | z-ai-web-dev-sdk |
| Voice Ops | `VoiceOps.tsx` | `/api/medflow/voice-ops` | Command parser |
| Compliance | `sections/ContinuousCompliance.tsx` | `/api/medflow/controls` | Computed from live signals |
| Billing | `sections/StripeBilling.tsx` | `/api/medflow/stripe` | Prisma + mock Stripe |
| Patient Portal | `sections/PatientPortal.tsx` | `/api/medflow/patient-portal` | Prisma |
| HIPAA SRA | `sections/HipaaSra.tsx` | `/api/medflow/sra` | Static questionnaire |
| Model Health | `sections/ModelHealth.tsx` | `/api/medflow/model-health` | Mock telemetry |
| Explainability | `sections/Explainability.tsx` | `/api/medflow/explainability` | Mock decisions |
| Autonomous SOC | `sections/AutonomousSOC.tsx` | `/api/medflow/autonomous-soc` | Mock threats |
| Workforce | `sections/WorkforceMgmt.tsx` | `/api/medflow/wfm` | Prisma User + Shift |
| Live Dictation | `sections/LiveDictation.tsx` | `/api/streaming/transcribe-chunk` | z-ai-web-dev-sdk ASR |
