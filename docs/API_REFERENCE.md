# MedFlow Transcribe AI — API Reference

## Next.js API Routes (port 3000)

### Core Data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/medflow/jobs` | List all transcription jobs (with relations) |
| POST | `/api/medflow/jobs` | Create a new job (from Upload Dictation form) |
| POST | `/api/medflow/job-status` | Advance/change a job's workflow status |
| GET | `/api/medflow/dashboard` | Aggregate metrics (KPIs, charts, audit, alerts) |
| GET | `/api/medflow/options` | Dropdown options (providers, facilities, etc.) |
| POST | `/api/medflow/upload` | Upload dictation audio + create job |

### Team & Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/medflow/team` | Team members + skills + shifts |
| GET | `/api/medflow/templates` | Document templates library |
| GET | `/api/medflow/integrations` | EHR integrations + delivery destinations |
| GET | `/api/medflow/clarifications` | Clarification requests + messages |
| GET | `/api/medflow/notifications` | Notifications list |
| PATCH | `/api/medflow/notifications` | Mark notification as read |

### Compliance & Billing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/medflow/audit` | Audit events + security alerts + retention policy |
| GET | `/api/medflow/billing` | Subscription + usage records |
| GET | `/api/medflow/controls` | 16 live compliance controls with status |
| POST | `/api/medflow/audit-pack` | Generate downloadable audit evidence bundle |

### Autonomy Features
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/medflow/autopilot` | Auto-pilot status + toggle + exception queue |
| GET | `/api/medflow/autonomous-soc` | Threat feed + response playbooks |
| GET | `/api/medflow/model-health` | AI model metrics + drift + retraining |
| GET | `/api/medflow/auto-remediation` | Auto-fix log + pending items |
| GET | `/api/medflow/explainability` | AI decision explanations |
| GET | `/api/medflow/routing-optimization` | Self-optimizing routing metrics |
| GET | `/api/medflow/routing-config` | Confidence routing thresholds |
| GET/POST | `/api/medflow/workflow-rules` | Visual workflow rule CRUD |
| GET | `/api/medflow/wfm` | Workforce leaderboard + shifts + skills |
| GET | `/api/medflow/smart-apps` | SMART on FHIR app catalog |
| GET | `/api/medflow/patient-portal` | Patient documents + consent + DSR |
| GET | `/api/medflow/sra` | HIPAA SRA questionnaire |
| POST | `/api/medflow/sra` | Submit SRA answers → risk score |
| GET | `/api/medflow/zero-trust` | Zero trust posture telemetry |
| GET | `/api/medflow/siem` | SIEM connection + alert feed |
| GET | `/api/medflow/stripe` | Stripe billing data (mock) |
| GET | `/api/medflow/client-portal` | White-label client portal config |
| GET | `/api/medflow/mobile-config` | Mobile app config + stats |
| POST | `/api/medflow/voice-ops` | Natural language command parser |

### AI Chat & Streaming
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | LLM chat completion (z-ai-web-dev-sdk) |
| POST | `/api/chat/asr` | Speech-to-text (z-ai-web-dev-sdk ASR) |
| POST | `/api/chat/tts` | Text-to-speech (z-ai-web-dev-sdk TTS) |
| POST | `/api/chat/agent` | Trigger FastAPI agent run from chatbot |
| POST | `/api/streaming/transcribe-chunk` | Real-time ASR for live dictation |

### FastAPI Proxy
| Method | Path | Description |
|--------|------|-------------|
| ANY | `/api/ai/[...path]` | Catch-all proxy → localhost:8000 (retry-resilient) |

---

## FastAPI Backend (port 8000)

### AI Agents
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List all 10 agents with status |
| GET | `/api/agents/{id}` | Single agent detail |
| POST | `/api/agents/{id}/run` | Run an agent (job_id, tenant_id, correlation_id) |
| GET | `/api/agents/runs` | Recent runs across all agents |

### Multi-DB Connectors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/db/connectors` | List 5 DB backends (SQLite/Postgres/Supabase/MySQL/MongoDB) |
| POST | `/api/db/connectors/test` | Test a connection |
| POST | `/api/db/connectors/{id}/switch` | Switch active connector |
| GET | `/api/db/schema` | Prisma entity list |

### FHIR & HL7
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/fhir/{job_id}` | FHIR R4 DocumentReference bundle |
| GET | `/api/hl7/{job_id}` | HL7 v2.5 MDM^T02 message |
| GET | `/api/fhir/subscription` | List FHIR subscriptions |
| POST | `/api/fhir/subscription` | Create subscription |
| POST | `/api/fhir/subscription/{id}/fire` | Fire subscription (deliver) |
| DELETE | `/api/fhir/subscription/{id}` | Cancel subscription |

### DirectTrust
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/direct/send` | Send document via Direct (S/MIME) |
| GET | `/api/direct/log` | Direct message log |

### AI Features
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/copilot/summarize` | AI Ops Copilot summary |
| POST | `/api/entities/extract` | Medical entity extraction (SNOMED/ICD-10/CPT/RxNorm) |
| POST | `/api/hallucination/detect` | Hallucination + conflict detection |

### Health & Integrations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service health check |
| GET | `/api/integrations` | 8 EHR integration adapter types |
| GET | `/` | Service landing + Swagger link |
| GET | `/docs` | Swagger UI (interactive API docs) |

---

## Request/Response Examples

### Run the Transcription Agent
```bash
POST /api/ai/agents/transcription/run
Content-Type: application/json

{
  "job_id": "JOB-2024-001",
  "tenant_id": "org_demo",
  "correlation_id": "corr-abc123"
}
```

Response:
```json
{
  "agent_id": "transcription",
  "job_id": "JOB-2024-001",
  "status": "succeeded",
  "duration_ms": 736,
  "cost_usd": 0.0011,
  "model": "whisper-large-v3",
  "output": {
    "transcript": "This is Dr. Emily Carter...",
    "confidence": 0.92,
    "duration_seconds": 273
  }
}
```

### Toggle Auto-Pilot
```bash
POST /api/medflow/autopilot
Content-Type: application/json

{ "enabled": true }
```

### Voice Command
```bash
POST /api/medflow/voice-ops
Content-Type: application/json

{ "command": "show me STAT jobs at risk" }
```

Response:
```json
{
  "action": "navigate:jobs",
  "filter": "priority=STAT",
  "response": "Showing all STAT priority jobs. There are 2 STAT jobs in the pipeline, 1 at SLA breach risk.",
  "recognized": true
}
```
