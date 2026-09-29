"""
================================================================================
MedFlow Transcribe AI — AI Agent Orchestration & Multi-Database Connector Service
================================================================================

This is the **FastAPI backend** mini-service for the MedFlow Transcribe AI
Medical Transcription BPO SaaS. The Next.js frontend (port 3000) calls this
service through the Caddy gateway. Frontend requests use a relative path with
`?XTransformPort=8000` (e.g. `fetch('/api/agents?XTransformPort=8000')`) and
Caddy forwards the request to `localhost:8000` after stripping the query.

Because of that gateway convention, ALL routes in this service are mounted at
`/api/...` (NOT `/api/v1/...`). Keep it simple.

Responsibilities:
  1. Orchestrate 10 AI agents (intake-validation → reporting).
  2. Abstract multi-database connectors (SQLite / PostgreSQL / Supabase /
     MySQL / MongoDB) with simulated connection-test + switch endpoints.
  3. Generate synthetic FHIR R4 (DocumentReference) + HL7 v2.5 (MDM^T02)
     payloads for downstream EHR delivery.
  4. Expose integration adapter catalogue (Epic, Cerner, SFTP, HL7, etc.).
  5. In-memory demo state (no DB in this service — Next.js app owns Prisma/SQLite).

Python: 3.12  •  FastAPI 0.128  •  uvicorn 0.44  •  pydantic 2.12
"""

from __future__ import annotations

import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel, Field

# =====================================================================
# Logging setup
# =====================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-agents-service")

# =====================================================================
# Constants
# =====================================================================
SERVICE_NAME = "ai-agents-service"
SERVICE_VERSION = "1.0.0"
DEFAULT_PROMPT_VERSION = "v1.2.0"

# =====================================================================
# In-memory state (seeded demo data; no DB needed in this service)
# =====================================================================

# --- Seeded synthetic patient demo jobs ---
# These power the FHIR / HL7 export endpoints with realistic content.
SEED_JOBS: dict[str, dict[str, Any]] = {
    "JOB-2024-001": {
        "job_id": "JOB-2024-001",
        "tenant_id": "org_demo",
        "patient": {
            "mrn": "SYN-884721",
            "name": "Synthetic Patient Alpha",
            "dob": "1968-04-12",
            "gender": "male",
        },
        "provider": {"npi": "1932456789", "name": "Dr. Synthetic Cardiologist"},
        "encounter": {
            "type": "cardiology_followup",
            "date": "2024-09-15",
            "facility": "Synthetic Heart Center",
            "department": "Cardiology",
        },
        "audio_minutes": 4.55,
        "priority": "urgent",
        "specialty": "Cardiology",
    },
    "JOB-2024-002": {
        "job_id": "JOB-2024-002",
        "tenant_id": "org_demo",
        "patient": {
            "mrn": "SYN-884722",
            "name": "Synthetic Patient Beta",
            "dob": "1975-11-30",
            "gender": "female",
        },
        "provider": {"npi": "1932456790", "name": "Dr. Synthetic Orthopedist"},
        "encounter": {
            "type": "knee_arthroscopy_postop",
            "date": "2024-09-16",
            "facility": "Synthetic Bone & Joint Clinic",
            "department": "Orthopedics",
        },
        "audio_minutes": 6.20,
        "priority": "normal",
        "specialty": "Orthopedics",
    },
    "JOB-2024-003": {
        "job_id": "JOB-2024-003",
        "tenant_id": "org_demo",
        "patient": {
            "mrn": "SYN-884723",
            "name": "Synthetic Patient Gamma",
            "dob": "1990-02-08",
            "gender": "female",
        },
        "provider": {"npi": "1932456791", "name": "Dr. Synthetic Endocrinologist"},
        "encounter": {
            "type": "diabetes_followup",
            "date": "2024-09-17",
            "facility": "Synthetic Endocrine Clinic",
            "department": "Endocrinology",
        },
        "audio_minutes": 3.80,
        "priority": "normal",
        "specialty": "Endocrinology",
    },
    "JOB-2024-004": {
        "job_id": "JOB-2024-004",
        "tenant_id": "org_demo",
        "patient": {
            "mrn": "SYN-884724",
            "name": "Synthetic Patient Delta",
            "dob": "1955-07-22",
            "gender": "male",
        },
        "provider": {"npi": "1932456792", "name": "Dr. Synthetic Pulmonologist"},
        "encounter": {
            "type": "copd_exacerbation",
            "date": "2024-09-18",
            "facility": "Synthetic Lung Center",
            "department": "Pulmonology",
        },
        "audio_minutes": 5.40,
        "priority": "urgent",
        "specialty": "Pulmonology",
    },
    "JOB-2024-005": {
        "job_id": "JOB-2024-005",
        "tenant_id": "org_demo",
        "patient": {
            "mrn": "SYN-884725",
            "name": "Synthetic Patient Epsilon",
            "dob": "1982-12-05",
            "gender": "male",
        },
        "provider": {"npi": "1932456793", "name": "Dr. Synthetic Neurologist"},
        "encounter": {
            "type": "migraine_eval",
            "date": "2024-09-19",
            "facility": "Synthetic Neuro Clinic",
            "department": "Neurology",
        },
        "audio_minutes": 4.10,
        "priority": "normal",
        "specialty": "Neurology",
    },
    "JOB-2024-006": {
        "job_id": "JOB-2024-006",
        "tenant_id": "org_demo",
        "patient": {
            "mrn": "SYN-884726",
            "name": "Synthetic Patient Zeta",
            "dob": "1970-03-18",
            "gender": "female",
        },
        "provider": {"npi": "1932456794", "name": "Dr. Synthetic Pediatrician"},
        "encounter": {
            "type": "well_child_check",
            "date": "2024-09-20",
            "facility": "Synthetic Pediatric Clinic",
            "department": "Pediatrics",
        },
        "audio_minutes": 3.20,
        "priority": "normal",
        "specialty": "Pediatrics",
    },
}

# --- 10 AI agents catalogue ---
# Each entry mirrors the data shape the frontend expects to render on the
# Agent Operations board (cards with status pill, model, last run metrics, etc.)
AGENTS: dict[str, dict[str, Any]] = {
    "intake-validation": {
        "id": "intake-validation",
        "name": "Intake Validation Agent",
        "description": "Validates incoming metadata, audio file integrity, checksums, "
        "and runs malware scan before a job enters the pipeline.",
        "category": "governance",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "rule-engine",
        "prompt_version": "v1.0.3",
        "supports_human_escalation": False,
        "input_schema": {
            "job_id": "string",
            "tenant_id": "string",
            "audio_uri": "string (s3://...)",
            "metadata": "object (provider, patient_mrn, encounter)",
        },
        "output_schema": {
            "valid": "boolean",
            "issues": "string[]",
            "metadata_completeness": "number (0-1)",
            "checksum_verified": "boolean",
            "malware_scan": "string (clean|flagged)",
        },
        "recent_runs": [],
    },
    "transcription": {
        "id": "transcription",
        "name": "Transcription Agent",
        "description": "Runs Whisper-based speech-to-text on the audio, returns the "
        "raw transcript with confidence scores and low-confidence regions.",
        "category": "ai",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "whisper-large-v3",
        "prompt_version": "v2.4.1",
        "supports_human_escalation": True,
        "input_schema": {
            "job_id": "string",
            "audio_uri": "string (s3://...)",
            "language_hint": "string (optional)",
        },
        "output_schema": {
            "transcript": "string",
            "confidence": "number (0-1)",
            "low_confidence_regions": "array<{start_ms,end_ms,reason}>",
            "language": "string",
            "duration_seconds": "number",
            "model": "string",
        },
        "recent_runs": [],
    },
    "structuring": {
        "id": "structuring",
        "name": "Clinical Document Structuring Agent",
        "description": "Formats the raw transcript into the chosen clinical template "
        "(SOAP, Operative Note, Discharge Summary) and extracts entities.",
        "category": "ai",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "glm-4-longcontext",
        "prompt_version": DEFAULT_PROMPT_VERSION,
        "supports_human_escalation": True,
        "input_schema": {
            "job_id": "string",
            "transcript": "string",
            "document_template_id": "string (e.g. tpl_soap)",
        },
        "output_schema": {
            "document_type": "string",
            "sections": "array<{title, body}>",
            "extracted_entities": "object",
            "uncertain_markers": "string[]",
        },
        "recent_runs": [],
    },
    "qa": {
        "id": "qa",
        "name": "Medical QA Agent",
        "description": "Performs risk and quality scoring; flags medication conflicts, "
        "laterality ambiguity, missing allergies, etc.",
        "category": "ai",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "glm-4-longcontext",
        "prompt_version": DEFAULT_PROMPT_VERSION,
        "supports_human_escalation": True,
        "input_schema": {
            "job_id": "string",
            "structured_doc": "object",
        },
        "output_schema": {
            "quality_score": "number (0-100)",
            "risk_score": "number (0-1)",
            "severity": "string (low|medium|high)",
            "findings": "array<{type, severity, detail, suggestion}>",
            "recommended_action": "string",
        },
        "recent_runs": [],
    },
    "allocation": {
        "id": "allocation",
        "name": "Work Allocation Agent",
        "description": "Routes a validated job to the best human transcriber / QA "
        "reviewer based on specialty, shift, workload, and QA score.",
        "category": "orchestration",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "internal",
        "prompt_version": "v1.4.0",
        "supports_human_escalation": False,
        "input_schema": {
            "job_id": "string",
            "specialty": "string",
            "priority": "string",
        },
        "output_schema": {
            "assigned_user_id": "string",
            "assigned_user_name": "string",
            "reason": "string",
            "fallback_queue": "string",
            "correlation_id": "string",
        },
        "recent_runs": [],
    },
    "sla": {
        "id": "sla",
        "name": "SLA Monitoring Agent",
        "description": "Continuously flags jobs at 50/75/90/100% of SLA window "
        "and triggers escalation workflows.",
        "category": "monitoring",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "rule-engine",
        "prompt_version": "v1.1.0",
        "supports_human_escalation": False,
        "input_schema": {
            "tenant_id": "string",
            "window_minutes": "number",
        },
        "output_schema": {
            "jobs_at_risk": "array<{job_id, sla_pct, priority}>",
            "escalation_triggered": "number",
        },
        "recent_runs": [],
    },
    "delivery": {
        "id": "delivery",
        "name": "Delivery Agent",
        "description": "Delivers the final clinical document to the configured "
        "destination (FHIR webhook, HL7 v2, customer portal, SFTP).",
        "category": "delivery",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "internal",
        "prompt_version": "v1.3.2",
        "supports_human_escalation": True,
        "input_schema": {
            "job_id": "string",
            "destination_id": "string",
            "format": "string (fhir|hl7|portal|sftp)",
        },
        "output_schema": {
            "channel": "string",
            "destination_id": "string",
            "status": "string (delivered|failed|queued)",
            "response_code": "number",
            "latency_ms": "number",
            "retry_count": "number",
        },
        "recent_runs": [],
    },
    "billing": {
        "id": "billing",
        "name": "Billing and Usage Agent",
        "description": "Meters audio/AI minutes per job, computes cost against the "
        "tenant subscription plan, tracks remaining quota and overage.",
        "category": "billing",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "internal",
        "prompt_version": "v1.2.1",
        "supports_human_escalation": False,
        "input_schema": {
            "job_id": "string",
            "tenant_id": "string",
            "audio_minutes": "number",
        },
        "output_schema": {
            "audio_minutes": "number",
            "ai_minutes": "number",
            "cost_usd": "number",
            "plan": "string",
            "remaining_minutes": "number",
            "overage": "boolean",
        },
        "recent_runs": [],
    },
    "security": {
        "id": "security",
        "name": "Security Monitoring Agent",
        "description": "Detects anomalies — bulk downloads, off-hours access, "
        "impossible-travel logins — and revokes support access if needed.",
        "category": "security",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "rule-engine",
        "prompt_version": "v1.5.0",
        "supports_human_escalation": True,
        "input_schema": {
            "tenant_id": "string",
            "window_minutes": "number",
        },
        "output_schema": {
            "alerts": "array<{type, severity, user_id, detail}>",
            "revoked_support_access": "number",
        },
        "recent_runs": [],
    },
    "reporting": {
        "id": "reporting",
        "name": "Reporting Agent",
        "description": "Generates scheduled and on-demand operational / clinical "
        "reports (turnaround, QA scores, productivity) as PDF/CSV.",
        "category": "reporting",
        "status": "idle",
        "last_run_at": None,
        "last_duration_ms": None,
        "last_cost_usd": None,
        "success_count": 0,
        "failure_count": 0,
        "model": "internal",
        "prompt_version": "v1.1.4",
        "supports_human_escalation": False,
        "input_schema": {
            "report_type": "string (turnaround|qa|productivity)",
            "tenant_id": "string",
            "period": "string (ISO8601 range)",
            "format": "string (pdf|csv)",
        },
        "output_schema": {
            "report_id": "string",
            "generated_at": "string (ISO8601)",
            "format": "string",
            "s3_uri": "string",
            "rows": "number",
        },
        "recent_runs": [],
    },
}

# Order is used to render the agent pipeline left-to-right on the frontend.
AGENT_ORDER = [
    "intake-validation",
    "transcription",
    "structuring",
    "qa",
    "allocation",
    "sla",
    "delivery",
    "billing",
    "security",
    "reporting",
]

# In-memory log of all agent runs (capped at 100).
RUNS: list[dict[str, Any]] = []

# Active database connector — defaults to sqlite (the Next.js Prisma DB).
ACTIVE_DB_CONNECTOR = "sqlite"


# =====================================================================
# Pydantic request models (pragmatic — keep typing loose for `input`)
# =====================================================================


class AgentRunRequest(BaseModel):
    """Body for POST /api/agents/{agent_id}/run."""

    job_id: str = Field(..., description="TranscriptionJob id, e.g. JOB-2024-001")
    tenant_id: str = Field(..., description="Organization id owning the job")
    correlation_id: Optional[str] = Field(
        None, description="Optional trace id to propagate across agents"
    )
    input: Optional[dict[str, Any]] = Field(
        None, description="Optional agent-specific input overrides"
    )


class DBTestRequest(BaseModel):
    """Body for POST /api/db/connectors/test."""

    connector: str = Field(..., description="One of: sqlite, postgres, supabase, mysql, mongodb")
    connection_string: str = Field(..., description="Raw connection string to validate")


class DBSwitchRequest(BaseModel):
    """Body for POST /api/db/connectors/{connector}/switch."""

    connection_string: str = Field(..., description="Connection string for new backend")


# =====================================================================
# Helper functions
# =====================================================================


def _now_iso() -> str:
    """ISO-8601 UTC timestamp string."""
    return datetime.now(timezone.utc).isoformat()


def _generate_correlation_id() -> str:
    """Generate a synthetic correlation id (used when caller omits one)."""
    return f"corr-{uuid.uuid4().hex[:12]}"


def _summarize_agent(a: dict[str, Any]) -> dict[str, Any]:
    """Return the public-facing agent object (without recent_runs to keep list light)."""
    return {
        "id": a["id"],
        "name": a["name"],
        "description": a["description"],
        "category": a["category"],
        "status": a["status"],
        "last_run_at": a["last_run_at"],
        "last_duration_ms": a["last_duration_ms"],
        "last_cost_usd": a["last_cost_usd"],
        "success_count": a["success_count"],
        "failure_count": a["failure_count"],
        "model": a["model"],
        "prompt_version": a["prompt_version"],
        "supports_human_escalation": a["supports_human_escalation"],
        "input_schema": a["input_schema"],
        "output_schema": a["output_schema"],
    }


def _agent_output(agent_id: str, job_id: str, correlation_id: str) -> dict[str, Any]:
    """
    Produce a realistic, agent-type-specific output payload.
    The shapes are defined in the task spec — keep them faithful.
    """
    # Pull the seeded demo job so transcripts reference synthetic patient data.
    job = SEED_JOBS.get(job_id, {})
    specialty = job.get("encounter", {}).get("type", "cardiology_followup") if job else "cardiology_followup"
    patient_name = job.get("patient", {}).get("name", "Synthetic Patient")
    provider_name = job.get("provider", {}).get("name", "Dr. Synthetic Provider")
    facility = job.get("encounter", {}).get("facility", "Synthetic Clinic")
    audio_minutes = job.get("audio_minutes", 4.55)

    if agent_id == "intake-validation":
        return {
            "valid": True,
            "issues": [],
            "metadata_completeness": 0.97,
            "checksum_verified": True,
            "malware_scan": "clean",
        }

    if agent_id == "transcription":
        transcript = (
            f"This is {provider_name}. I'm seeing the patient today for a "
            f"{specialty.replace('_', ' ')} follow-up. The patient reports "
            "feeling somewhat better since the last visit, with reduced shortness "
            "of breath on exertion. Blood pressure today is 132 over 84, heart "
            "rate 74 and regular, respirations 16, oxygen saturation 97 percent "
            "on room air. Lungs are clear to auscultation bilaterally, no wheeze "
            "or crackles. Cardiovascular exam reveals a regular rate and rhythm, "
            "no murmurs, rubs or gallops. I'm going to continue the current "
            "medication regimen and reorder a lipid panel and BMP in three months. "
            "Will follow up in six months, sooner if symptoms worsen."
        )
        return {
            "transcript": transcript,
            "confidence": 0.92,
            "low_confidence_regions": [
                {"start_ms": 12000, "end_ms": 14500, "reason": "background noise"},
                {"start_ms": 18000, "end_ms": 19500, "reason": "speaker overlap"},
            ],
            "language": "en-US",
            "duration_seconds": round(audio_minutes * 60),
            "model": "whisper-large-v3",
        }

    if agent_id == "structuring":
        return {
            "document_type": "SOAP Note",
            "sections": [
                {
                    "title": "Subjective",
                    "body": (
                        f"Patient seen for {specialty.replace('_', ' ')} follow-up. "
                        "Reports improvement in symptoms since last visit with reduced "
                        "shortness of breath on exertion."
                    ),
                },
                {
                    "title": "Objective",
                    "body": (
                        "BP 132/84, HR 74 regular, RR 16, SpO2 97% on room air. "
                        "Lungs clear bilaterally. No murmurs, rubs or gallops."
                    ),
                },
                {
                    "title": "Assessment",
                    "body": (
                        "Stable cardiology patient with adequate symptom control on "
                        "current regimen. No acute findings on exam today."
                    ),
                },
                {
                    "title": "Plan",
                    "body": (
                        "Continue current medications. Reorder lipid panel and BMP "
                        "in three months. Follow up in six months."
                    ),
                },
            ],
            "extracted_entities": {
                "medications": [
                    {"name": "Lisinopril", "dose": "10 mg", "route": "PO", "frequency": "daily"},
                    {"name": "Atorvastatin", "dose": "20 mg", "route": "PO", "frequency": "nightly"},
                ],
                "allergies": [
                    {"substance": "Penicillin", "reaction": "rash", "severity": "mild"}
                ],
                "diagnoses": [
                    {"code": "I25.10", "system": "ICD-10", "description": "Atherosclerotic heart disease"}
                ],
                "vitals": [
                    {"name": "BP", "value": "132/84", "unit": "mmHg"},
                    {"name": "HR", "value": "74", "unit": "bpm"},
                    {"name": "SpO2", "value": "97", "unit": "%"},
                ],
            },
            "uncertain_markers": ["[INAUDIBLE]"],
        }

    if agent_id == "qa":
        return {
            "quality_score": 88,
            "risk_score": 0.22,
            "severity": "medium",
            "findings": [
                {
                    "type": "medication_conflict",
                    "severity": "medium",
                    "detail": "Lisinopril dose discrepancy (10mg vs 20mg)",
                    "suggestion": "Confirm with provider",
                },
                {
                    "type": "laterality",
                    "severity": "low",
                    "detail": "left/right ambiguity in knee exam",
                    "suggestion": "Transcriptionist to clarify",
                },
            ],
            "recommended_action": "route_to_qa",
        }

    if agent_id == "allocation":
        return {
            "assigned_user_id": "u_3",
            "assigned_user_name": "Priya Nair",
            "reason": (
                "Specialty=Cardiology match, shift active, workload 4/10, QA score 94"
            ),
            "fallback_queue": "unassigned_priority",
            "correlation_id": correlation_id,
        }

    if agent_id == "sla":
        return {
            "jobs_at_risk": [
                {"job_id": "JOB-2024-004", "sla_pct": 0.78, "priority": "urgent"},
                {"job_id": "JOB-2024-001", "sla_pct": 0.65, "priority": "urgent"},
                {"job_id": "JOB-2024-007", "sla_pct": 0.92, "priority": "normal"},
            ],
            "escalation_triggered": 2,
        }

    if agent_id == "delivery":
        return {
            "channel": "fhir_webhook",
            "destination_id": "dest_ehr_1",
            "status": "delivered",
            "response_code": 200,
            "latency_ms": 412,
            "retry_count": 0,
        }

    if agent_id == "billing":
        return {
            "audio_minutes": round(audio_minutes, 2),
            "ai_minutes": round(audio_minutes, 2),
            "cost_usd": round(audio_minutes * 0.09, 2),
            "plan": "Professional",
            "remaining_minutes": 1245,
            "overage": False,
        }

    if agent_id == "security":
        return {
            "alerts": [
                {
                    "type": "bulk_download",
                    "severity": "medium",
                    "user_id": "u_7",
                    "detail": "42 document downloads in 10 min",
                }
            ],
            "revoked_support_access": 1,
        }

    if agent_id == "reporting":
        return {
            "report_id": f"rpt-{uuid.uuid4().hex[:8]}",
            "generated_at": _now_iso(),
            "format": "pdf",
            "s3_uri": "s3://medflow-reports/2024/09/turnaround-weekly.pdf",
            "rows": 1284,
        }

    # Fallback (shouldn't happen because callers are validated upstream)
    return {"note": "no output defined"}


def _approx_cost_usd(agent_id: str, duration_ms: int) -> float:
    """Rough cost in USD for the simulated agent run."""
    # Whisper transcription is the priciest; rule-engine agents ~free.
    per_minute_cost = {
        "transcription": 0.09,
        "structuring": 0.06,
        "qa": 0.04,
        "intake-validation": 0.0,
        "allocation": 0.0,
        "sla": 0.0,
        "delivery": 0.0,
        "billing": 0.0,
        "security": 0.0,
        "reporting": 0.005,
    }.get(agent_id, 0.01)
    return round((duration_ms / 1000.0 / 60.0) * per_minute_cost, 4)


# =====================================================================
# Database connector catalogue
# =====================================================================

DB_CONNECTORS: dict[str, dict[str, Any]] = {
    "sqlite": {
        "id": "sqlite",
        "label": "SQLite",
        "engine": "sqlite3",
        "color": "#0B5345",
        "supports": ["relational"],
        "connection_string_format": "file:./medflow.db",
        "status": "connected",
        "default": True,
        "notes": "Local dev & small clinics",
    },
    "postgres": {
        "id": "postgres",
        "label": "PostgreSQL",
        "engine": "psql",
        "color": "#1ABC9C",
        "supports": ["relational", "full-text", "jsonb"],
        "connection_string_format": "postgresql://user:pass@host:5432/db",
        "status": "available",
        "default": False,
        "notes": "Multi-tenant production",
    },
    "supabase": {
        "id": "supabase",
        "label": "Supabase",
        "engine": "postgres",
        "color": "#10B981",
        "supports": ["relational", "realtime", "auth", "storage"],
        "connection_string_format": "postgresql://postgres:[PROJECT-REF]@db.[project].supabase.co:5432/postgres",
        "status": "available",
        "default": False,
        "notes": "Postgres + realtime + auth",
    },
    "mysql": {
        "id": "mysql",
        "label": "MySQL",
        "engine": "mysql",
        "color": "#2980B9",
        "supports": ["relational"],
        "connection_string_format": "mysql://user:pass@host:3306/db",
        "status": "available",
        "default": False,
        "notes": "Legacy hospital systems",
    },
    "mongodb": {
        "id": "mongodb",
        "label": "MongoDB",
        "engine": "pymongo",
        "color": "#58D68D",
        "supports": ["document", "flexible-schema"],
        "connection_string_format": "mongodb+srv://user:pass@cluster/db",
        "status": "available",
        "default": False,
        "notes": "Unstructured clinical notes",
    },
}

# Prisma-equivalent entity catalogue (mirrors the BPO schema decided in Task 1).
# These field/relation counts are approximate but consistent with the schema.
DB_SCHEMA_ENTITIES: list[dict[str, Any]] = [
    {"name": "Organization", "fields": 9, "relations": 4, "tenant_scoped": False},
    {"name": "User", "fields": 14, "relations": 5, "tenant_scoped": True},
    {"name": "Provider", "fields": 8, "relations": 3, "tenant_scoped": True},
    {"name": "Facility", "fields": 7, "relations": 2, "tenant_scoped": True},
    {"name": "Department", "fields": 5, "relations": 2, "tenant_scoped": True},
    {"name": "Specialty", "fields": 4, "relations": 1, "tenant_scoped": False},
    {"name": "DocumentTemplate", "fields": 8, "relations": 2, "tenant_scoped": True},
    {"name": "TranscriptionJob", "fields": 18, "relations": 7, "tenant_scoped": True},
    {"name": "JobEvent", "fields": 7, "relations": 1, "tenant_scoped": True},
    {"name": "Assignment", "fields": 9, "relations": 3, "tenant_scoped": True},
    {"name": "QualityReview", "fields": 8, "relations": 2, "tenant_scoped": True},
    {"name": "QualityFinding", "fields": 7, "relations": 1, "tenant_scoped": True},
    {"name": "ClarificationRequest", "fields": 6, "relations": 2, "tenant_scoped": True},
    {"name": "ClarificationMessage", "fields": 5, "relations": 1, "tenant_scoped": True},
    {"name": "AuditEvent", "fields": 9, "relations": 1, "tenant_scoped": True},
    {"name": "Subscription", "fields": 10, "relations": 1, "tenant_scoped": True},
    {"name": "UsageRecord", "fields": 7, "relations": 1, "tenant_scoped": True},
    {"name": "IntegrationConnection", "fields": 8, "relations": 2, "tenant_scoped": True},
    {"name": "DeliveryDestination", "fields": 8, "relations": 2, "tenant_scoped": True},
    {"name": "DataRetentionPolicy", "fields": 6, "relations": 1, "tenant_scoped": True},
]


# =====================================================================
# Integration adapter catalogue
# =====================================================================

INTEGRATIONS: dict[str, dict[str, Any]] = {
    "epic": {
        "id": "epic",
        "label": "Epic EHR",
        "status": "available",
        "config_schema": {
            "type": "object",
            "required": ["base_url", "client_id", "client_secret"],
            "properties": {
                "base_url": {"type": "string", "format": "uri"},
                "client_id": {"type": "string"},
                "client_secret": {"type": "string"},
                "fhir_version": {"type": "string", "default": "r4"},
            },
        },
    },
    "cerner": {
        "id": "cerner",
        "label": "Cerner / Oracle Health",
        "status": "available",
        "config_schema": {
            "type": "object",
            "required": ["tenant_id", "base_url"],
            "properties": {
                "tenant_id": {"type": "string"},
                "base_url": {"type": "string", "format": "uri"},
                "fhir_version": {"type": "string", "default": "r4"},
            },
        },
    },
    "allscripts": {
        "id": "allscripts",
        "label": "Allscripts / Veradigm",
        "status": "available",
        "config_schema": {
            "type": "object",
            "required": ["base_url", "api_key"],
            "properties": {
                "base_url": {"type": "string", "format": "uri"},
                "api_key": {"type": "string"},
                "unit_id": {"type": "string"},
            },
        },
    },
    "athena": {
        "id": "athena",
        "label": "athenahealth",
        "status": "available",
        "config_schema": {
            "type": "object",
            "required": ["client_id", "client_secret", "practice_id"],
            "properties": {
                "client_id": {"type": "string"},
                "client_secret": {"type": "string"},
                "practice_id": {"type": "string"},
                "version": {"type": "string", "default": "preview1"},
            },
        },
    },
    "sftp": {
        "id": "sftp",
        "label": "SFTP (B2B)",
        "status": "available",
        "config_schema": {
            "type": "object",
            "required": ["host", "username", "private_key_path"],
            "properties": {
                "host": {"type": "string"},
                "port": {"type": "integer", "default": 22},
                "username": {"type": "string"},
                "private_key_path": {"type": "string"},
                "remote_dir": {"type": "string", "default": "/inbound"},
            },
        },
    },
    "rest_webhook": {
        "id": "rest_webhook",
        "label": "REST Webhook",
        "status": "available",
        "config_schema": {
            "type": "object",
            "required": ["url", "auth_header_name", "auth_header_value"],
            "properties": {
                "url": {"type": "string", "format": "uri"},
                "method": {"type": "string", "default": "POST"},
                "auth_header_name": {"type": "string"},
                "auth_header_value": {"type": "string"},
                "retry_policy": {"type": "string", "default": "exponential_backoff"},
            },
        },
    },
    "hl7_fhir": {
        "id": "hl7_fhir",
        "label": "HL7 FHIR R4",
        "status": "available",
        "config_schema": {
            "type": "object",
            "required": ["base_url"],
            "properties": {
                "base_url": {"type": "string", "format": "uri"},
                "fhir_version": {"type": "string", "default": "r4"},
                "bearer_token": {"type": "string"},
            },
        },
    },
    "hl7_v2": {
        "id": "hl7_v2",
        "label": "HL7 v2 (MLLP)",
        "status": "available",
        "config_schema": {
            "type": "object",
            "required": ["host", "port"],
            "properties": {
                "host": {"type": "string"},
                "port": {"type": "integer", "default": 2575},
                "message_type": {"type": "string", "default": "MDM^T02"},
                "ack_timeout_ms": {"type": "integer", "default": 10000},
            },
        },
    },
}


# =====================================================================
# FastAPI app + middleware
# =====================================================================

app = FastAPI(
    title="MedFlow Transcribe AI — AI Agent Orchestration Service",
    description=(
        "FastAPI backend for the MedFlow Transcribe AI Medical Transcription BPO "
        "SaaS. Exposes 10 AI agents, multi-DB connectors (SQLite/Postgres/Supabase/"
        "MySQL/MongoDB), and synthetic FHIR R4 / HL7 v2.5 export endpoints. "
        "Called by the Next.js frontend through the Caddy gateway via "
        "`?XTransformPort=8000`."
    ),
    version=SERVICE_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow all origins so the Caddy-gateway-proxied requests work.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup_event() -> None:
    """Log startup banner."""
    logger.info(
        "🚀 FastAPI AI Agents service starting on :8000 — Swagger at /docs"
    )


# Custom 500 handler — return a JSON envelope with a correlation id so the
# frontend can show the user an actionable trace id.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> Any:
    correlation_id = _generate_correlation_id()
    logger.exception("Unhandled error (correlation_id=%s): %s", correlation_id, exc)
    return _json_error(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error="internal_server_error",
        message=str(exc),
        correlation_id=correlation_id,
    )


def _json_error(status_code: int, error: str, message: str, correlation_id: str) -> Any:
    """Build a JSON error response envelope."""
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=status_code,
        content={
            "error": error,
            "message": message,
            "correlation_id": correlation_id,
        },
    )


# =====================================================================
# Root / landing
# =====================================================================


@app.get("/", response_class=HTMLResponse)
async def root() -> HTMLResponse:
    """Landing page describing the service."""
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>MedFlow Transcribe AI — AI Agent Orchestration Service</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: #E8F8F5; color: #17202A; margin: 0; padding: 48px 24px; }}
            .wrap {{ max-width: 880px; margin: 0 auto; }}
            h1 {{ color: #0B5345; font-size: 32px; margin-bottom: 8px; }}
            p.subtitle {{ color: #1ABC9C; font-size: 16px; margin-top: 0; }}
            .card {{ background: #fff; border-radius: 12px; padding: 24px;
                     box-shadow: 0 2px 8px rgba(0,0,0,.06); margin-top: 24px; }}
            .card h2 {{ color: #0B5345; margin-top: 0; font-size: 20px; }}
            .links {{ display: grid; gap: 8px; margin-top: 12px; }}
            .links a {{ color: #1ABC9C; text-decoration: none; font-weight: 600; }}
            .links a:hover {{ text-decoration: underline; }}
            .pill {{ display: inline-block; background: #0B5345; color: #fff;
                     padding: 2px 8px; border-radius: 6px; font-size: 12px; }}
            code {{ background: #f1f5f9; padding: 1px 6px; border-radius: 4px; }}
        </style>
    </head>
    <body>
        <div class="wrap">
            <h1>MedFlow Transcribe AI</h1>
            <p class="subtitle">
                AI Agent Orchestration &amp; Multi-Database Connector Service (FastAPI)
                <span class="pill">v{SERVICE_VERSION}</span>
            </p>
            <div class="card">
                <h2>What this service does</h2>
                <ul>
                    <li>Orchestrates <strong>10 AI agents</strong> (intake → reporting).</li>
                    <li>Abstracts <strong>multi-DB connectors</strong> (SQLite, PostgreSQL,
                        Supabase, MySQL, MongoDB).</li>
                    <li>Generates synthetic <strong>FHIR R4</strong> &amp; <strong>HL7 v2.5</strong> payloads.</li>
                    <li>Catalogues <strong>EHR integrations</strong> (Epic, Cerner, Allscripts, athena, SFTP, REST, HL7).</li>
                </ul>
            </div>
            <div class="card">
                <h2>Quick links</h2>
                <div class="links">
                    <a href="/docs">📘 FastAPI Swagger docs (/docs)</a>
                    <a href="/redoc">📕 ReDoc (/redoc)</a>
                    <a href="/api/health">🩺 Health check (/api/health)</a>
                    <a href="/api/agents">🤖 Agents list (/api/agents)</a>
                    <a href="/api/db/connectors">🗄️ DB connectors (/api/db/connectors)</a>
                    <a href="/api/fhir/JOB-2024-001">📋 FHIR sample (/api/fhir/JOB-2024-001)</a>
                </div>
            </div>
            <div class="card">
                <h2>How the Next.js frontend calls this</h2>
                <p>
                    Frontend fetches use a <em>relative</em> URL with
                    <code>?XTransformPort=8000</code> — the Caddy gateway strips
                    the query and forwards to <code>localhost:8000</code>.
                </p>
                <pre><code>fetch('/api/agents?XTransformPort=8000')</code></pre>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(html)


# =====================================================================
# Health
# =====================================================================


@app.get("/api/health")
async def health() -> dict[str, Any]:
    """Liveness / readiness probe."""
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "timestamp": _now_iso(),
        "agents_active": sum(
            1 for a in AGENTS.values() if a["status"] == "running"
        ),
    }


# =====================================================================
# AI Agents
# =====================================================================


@app.get("/api/agents")
async def list_agents() -> dict[str, Any]:
    """List all 10 AI agents (lightweight summary fields)."""
    return {
        "agents": [_summarize_agent(AGENTS[aid]) for aid in AGENT_ORDER],
        "count": len(AGENT_ORDER),
    }


@app.get("/api/agents/{agent_id}")
async def get_agent(agent_id: str) -> dict[str, Any]:
    """Full detail of one agent including the last 5 runs."""
    if agent_id not in AGENTS:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"Unknown agent_id '{agent_id}'",
                "correlation_id": _generate_correlation_id(),
            },
        )
    a = AGENTS[agent_id]
    detail = _summarize_agent(a)
    detail["recent_runs"] = a["recent_runs"][-5:]
    return detail


@app.post("/api/agents/{agent_id}/run")
async def run_agent(agent_id: str, body: AgentRunRequest) -> dict[str, Any]:
    """
    Simulate running an agent on a job. Sets the agent to `running`,
    sleeps 600-1500ms (simulated work), then produces a realistic,
    agent-type-specific output and records the run.
    """
    if agent_id not in AGENTS:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"Unknown agent_id '{agent_id}'",
                "correlation_id": _generate_correlation_id(),
            },
        )

    agent = AGENTS[agent_id]
    correlation_id = body.correlation_id or _generate_correlation_id()
    started_at = _now_iso()

    # Flip status to running.
    agent["status"] = "running"

    # Simulate latency between 600 and 1500 ms.
    duration_ms = random.randint(600, 1500)
    await asyncio.sleep(duration_ms / 1000.0)

    # ~5% chance of a simulated failure (with retry suggestion) — mostly succeed.
    # Skip failure chance for rule-engine agents on the seeded jobs to keep the
    # demo deterministic for the curl verification (transcription always succeeds).
    simulate_fail = (
        random.random() < 0.05
        and agent_id not in ("transcription",)
        and body.job_id in SEED_JOBS
    )

    completed_at = _now_iso()
    cost_usd = _approx_cost_usd(agent_id, duration_ms)

    if simulate_fail:
        # Failed run — increment failure count, append to recent_runs, do NOT
        # produce a typed output (return a failure envelope).
        agent["status"] = "failed"
        agent["failure_count"] += 1
        run_record = {
            "agent_id": agent_id,
            "job_id": body.job_id,
            "tenant_id": body.tenant_id,
            "correlation_id": correlation_id,
            "run_id": f"run-{uuid.uuid4().hex[:10]}",
            "status": "failed",
            "started_at": started_at,
            "completed_at": completed_at,
            "duration_ms": duration_ms,
            "cost_usd": cost_usd,
            "model": agent["model"],
            "prompt_version": agent["prompt_version"],
            "error": "Simulated transient failure",
            "retry_recommended": True,
        }
    else:
        # Success path — produce typed output, update agent counters.
        output = _agent_output(agent_id, body.job_id, correlation_id)
        agent["status"] = "succeeded"
        agent["success_count"] += 1
        agent["last_run_at"] = completed_at
        agent["last_duration_ms"] = duration_ms
        agent["last_cost_usd"] = cost_usd
        run_record = {
            "agent_id": agent_id,
            "job_id": body.job_id,
            "tenant_id": body.tenant_id,
            "correlation_id": correlation_id,
            "run_id": f"run-{uuid.uuid4().hex[:10]}",
            "status": "succeeded",
            "started_at": started_at,
            "completed_at": completed_at,
            "duration_ms": duration_ms,
            "cost_usd": cost_usd,
            "model": agent["model"],
            "prompt_version": agent["prompt_version"],
            "output": output,
        }

    # Update agent's recent_runs (cap 5 for the per-agent list).
    agent["recent_runs"].append(
        {
            "job_id": body.job_id,
            "status": run_record["status"],
            "duration_ms": duration_ms,
            "cost_usd": cost_usd,
            "timestamp": completed_at,
            "correlation_id": correlation_id,
        }
    )
    agent["recent_runs"] = agent["recent_runs"][-5:]

    # Update the global RUNS log (cap 100).
    RUNS.append(run_record)
    if len(RUNS) > 100:
        del RUNS[: len(RUNS) - 100]

    # Reset agent status to idle once the run is done (so the next call starts fresh).
    agent["status"] = "failed" if simulate_fail else "idle"
    # But mark the most recent outcome via last_run fields — kept above.

    logger.info(
        "agent run complete agent=%s job=%s status=%s duration_ms=%s",
        agent_id,
        body.job_id,
        run_record["status"],
        duration_ms,
    )

    return run_record


@app.get("/api/agents/runs")
async def list_runs(limit: int = 20) -> dict[str, Any]:
    """Recent agent runs across all agents (capped at the requested limit)."""
    capped = max(1, min(limit, 100))
    return {
        "runs": list(reversed(RUNS))[:capped],
        "count": len(RUNS),
        "returned": min(capped, len(RUNS)),
    }


# =====================================================================
# Multi-database connectors
# =====================================================================


@app.get("/api/db/connectors")
async def list_db_connectors() -> dict[str, Any]:
    """List supported DB backends with metadata."""
    return {
        "connectors": [DB_CONNECTORS[k] for k in DB_CONNECTORS],
        "count": len(DB_CONNECTORS),
        "active_connector": ACTIVE_DB_CONNECTOR,
    }


@app.post("/api/db/connectors/test")
async def test_db_connector(body: DBTestRequest) -> dict[str, Any]:
    """
    Simulate connection-string validation.
      • sqlite  → always succeed
      • others  → if connection_string contains the substring 'fail', fail;
                  otherwise succeed with random latency 80-300ms.
    """
    connector_id = body.connector
    if connector_id not in DB_CONNECTORS:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "unknown_connector",
                "message": (
                    f"Unknown connector '{connector_id}'. "
                    f"Supported: {list(DB_CONNECTORS.keys())}"
                ),
                "correlation_id": _generate_correlation_id(),
            },
        )

    tested_at = _now_iso()

    if connector_id == "sqlite":
        # sqlite always works in the demo environment.
        return {
            "connector": connector_id,
            "status": "ok",
            "latency_ms": random.randint(2, 12),
            "validation_errors": [],
            "tested_at": tested_at,
            "recommendation": (
                "Connection verified. SQLite is the active default backend."
            ),
        }

    # Simulate latency for remote backends.
    latency_ms = random.randint(80, 300)
    await asyncio.sleep(latency_ms / 1000.0)

    if "fail" in body.connection_string.lower():
        return {
            "connector": connector_id,
            "status": "failed",
            "latency_ms": latency_ms,
            "validation_errors": [
                "host_unreachable",
                "auth_rejected",
            ],
            "tested_at": tested_at,
            "recommendation": (
                "Verify credentials, network ACL, and that the host is reachable "
                "from the MedFlow VPC. Consider switching to a failover backend."
            ),
        }

    return {
        "connector": connector_id,
        "status": "ok",
        "latency_ms": latency_ms,
        "validation_errors": [],
        "tested_at": tested_at,
        "recommendation": (
            f"Connection verified. {DB_CONNECTORS[connector_id]['label']} "
            "is ready to be promoted to the active backend."
        ),
    }


@app.post("/api/db/connectors/{connector}/switch")
async def switch_db_connector(connector: str, body: DBSwitchRequest) -> dict[str, Any]:
    """
    Simulate promoting a connector to the active backend.
    For sqlite, always works. For others, simulate a migration with a
    deterministic count of migrated tables.
    """
    global ACTIVE_DB_CONNECTOR

    if connector not in DB_CONNECTORS:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "unknown_connector",
                "message": (
                    f"Unknown connector '{connector}'. "
                    f"Supported: {list(DB_CONNECTORS.keys())}"
                ),
                "correlation_id": _generate_correlation_id(),
            },
        )

    if connector != "sqlite" and "fail" in body.connection_string.lower():
        raise HTTPException(
            status_code=400,
            detail={
                "error": "switch_failed",
                "message": "Connection test failed — cannot switch backend.",
                "correlation_id": _generate_correlation_id(),
            },
        )

    previous = ACTIVE_DB_CONNECTOR
    ACTIVE_DB_CONNECTOR = connector

    # Reflect status changes in the catalogue.
    for cid, meta in DB_CONNECTORS.items():
        meta["status"] = "connected" if cid == connector else "available"

    migrated_tables = (
        0
        if connector == "sqlite" and previous == "sqlite"
        else random.randint(15, 25)
    )

    return {
        "previous_connector": previous,
        "active_connector": ACTIVE_DB_CONNECTOR,
        "switched_at": _now_iso(),
        "migrated_tables": migrated_tables,
        "status": "ok",
    }


@app.get("/api/db/schema")
async def get_db_schema() -> dict[str, Any]:
    """Return Prisma-equivalent entity list with field counts (mirrors BPO schema)."""
    return {
        "entities": DB_SCHEMA_ENTITIES,
        "count": len(DB_SCHEMA_ENTITIES),
        "active_connector": ACTIVE_DB_CONNECTOR,
    }


# =====================================================================
# FHIR & HL7 export
# =====================================================================


@app.get("/api/fhir/{job_id}")
async def get_fhir(job_id: str) -> dict[str, Any]:
    """
    Return a realistic FHIR R4 Bundle containing a DocumentReference plus
    placeholder Practitioner and Patient resources. All data is SYNTHETIC
    (marked with meta.security = SYNTHETIC).
    """
    job = SEED_JOBS.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"Unknown job_id '{job_id}'",
                "correlation_id": _generate_correlation_id(),
            },
        )

    patient = job["patient"]
    provider = job["provider"]
    encounter = job["encounter"]

    # Build a FHIR R4 Bundle (collection).
    bundle = {
        "resourceType": "Bundle",
        "id": f"bundle-{uuid.uuid4().hex[:12]}",
        "type": "collection",
        "meta": {
            "lastUpdated": _now_iso(),
            "security": [{"code": "SYNTHETIC", "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality"}],
        },
        "entry": [
            {
                "fullUrl": f"urn:uuid:{uuid.uuid4()}",
                "resource": {
                    "resourceType": "Patient",
                    "id": patient["mrn"],
                    "meta": {
                        "security": [{"code": "SYNTHETIC"}],
                    },
                    "identifier": [
                        {
                            "system": "http://medflow.local/mrn",
                            "value": patient["mrn"],
                        }
                    ],
                    "name": [{"family": patient["name"].split()[-1],
                              "given": patient["name"].split()[1:-1] or ["Synthetic"]}],
                    "gender": patient["gender"],
                    "birthDate": patient["dob"],
                },
            },
            {
                "fullUrl": f"urn:uuid:{uuid.uuid4()}",
                "resource": {
                    "resourceType": "Practitioner",
                    "id": provider["npi"],
                    "meta": {
                        "security": [{"code": "SYNTHETIC"}],
                    },
                    "identifier": [
                        {
                            "system": "http://hl7.org/fhir/sid/us-npi",
                            "value": provider["npi"],
                        }
                    ],
                    "name": [{"text": provider["name"]}],
                },
            },
            {
                "fullUrl": f"urn:uuid:{uuid.uuid4()}",
                "resource": {
                    "resourceType": "DocumentReference",
                    "id": f"docref-{job_id}",
                    "meta": {
                        "security": [{"code": "SYNTHETIC"}],
                        "versionId": "1",
                        "lastUpdated": _now_iso(),
                    },
                    "identifier": [
                        {
                            "system": "http://medflow.local/job",
                            "value": job_id,
                        }
                    ],
                    "status": "current",
                    "type": {
                        "coding": [
                            {
                                "system": "http://loinc.org",
                                "code": "11506-3",
                                "display": "Progress note",
                            }
                        ]
                    },
                    "category": [
                        {
                            "coding": [
                                {
                                    "system": "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
                                    "code": "clinical-note",
                                    "display": "Clinical Note",
                                }
                            ],
                        }
                    ],
                    "subject": {
                        "reference": f"Patient/{patient['mrn']}",
                        "display": patient["name"],
                    },
                    "author": [
                        {
                            "reference": f"Practitioner/{provider['npi']}",
                            "display": provider["name"],
                        }
                    ],
                    "created": _now_iso(),
                    "context": {
                        "period": {
                            "start": encounter["date"] + "T09:00:00Z",
                            "end": encounter["date"] + "T09:30:00Z",
                        },
                    },
                    "content": [
                        {
                            "attachment": {
                                "contentType": "text/plain",
                                "language": "en-US",
                                "title": f"{encounter['type'].replace('_', ' ').title()} — {encounter['facility']}",
                                "data": (
                                    "U0Q6IFBhdGllbnQgc2VlbiBmb3IgZm9sbG93LXVwLiBiaXJ0aGRhdGUg"
                                    "c3ludGhldGljLiBSZXBvcnRzIGltcHJvdmVtZW50Lg=="
                                ),
                            }
                        }
                    ],
                    "description": (
                        f"Synthetic clinical note for {encounter['type']} at "
                        f"{encounter['facility']} ({encounter['department']})."
                    ),
                },
            },
        ],
    }

    return {
        "job_id": job_id,
        "fhir_version": "r4",
        "generated_at": _now_iso(),
        "synthetic": True,
        "bundle": bundle,
    }


@app.get("/api/hl7/{job_id}", response_class=PlainTextResponse)
async def get_hl7(job_id: str) -> PlainTextResponse:
    """
    Return a realistic HL7 v2.5 MDM^T02 message as plain text.
    Segments: MSH, PID, PV1, TXA, OBX.
    All patient data is synthetic (MRN prefix SYN-).
    """
    job = SEED_JOBS.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"Unknown job_id '{job_id}'",
                "correlation_id": _generate_correlation_id(),
            },
        )

    patient = job["patient"]
    provider = job["provider"]
    encounter = job["encounter"]

    now = datetime.now(timezone.utc)
    ts_hl7 = now.strftime("%Y%m%d%H%M%S")
    msg_control_id = f"MF{now.strftime('%H%M%S')}{random.randint(100,999)}"

    # HL7 v2.5 uses | as the field separator (after MSH).
    # MSH|^~\&|SendingApp|SendingFac|ReceivingApp|ReceivingFac|YYYYMMDDHHMMSS||MDM^T02|...
    family = patient["name"].split()[-1]
    given = patient["name"].split()[1] if len(patient["name"].split()) > 1 else "Synthetic"

    lines = [
        f"MSH|^~\\&|MedFlow|{encounter['facility']}|EHR_INBOUND|EHR_FACILITY|{ts_hl7}||MDM^T02|{msg_control_id}|P|2.5|||||||||SYNTHETIC",
        f"PID|1||{patient['mrn']}^^^MedFlow^MRN||{family}^{given}||{patient['dob']}|{patient['gender'][0].upper()}",
        f"PV1|1|O|{encounter['facility']}^Cardiology^Bed1||||{provider['name']}"
        f"^^{provider['npi']}||||||||OP||||||||||||||||||||{encounter['date'].replace('-', '')}",
        f"TXA|1|OP|^Progress Note||{ts_hl7}||||{provider['name']}^{provider['npi']}|{encounter['date'].replace('-', '')}|||||AV|||SYNTHETIC",
        "OBX|1|TX|^Transcript||"
        "Patient seen for follow-up. Reports improvement in symptoms since last visit. "
        "BP 132/84, HR 74 regular, RR 16, SpO2 97% on room air. Lungs clear bilaterally. "
        "No murmurs, rubs, or gallops. Plan: continue current medications, reorder labs "
        "in three months.||||||F",
        "OBX|2|TX|^Assessment and Plan||"
        "Stable cardiology patient with adequate symptom control on current regimen. "
        "No acute findings. Follow up in six months.||||||F",
    ]
    return PlainTextResponse("\r\n".join(lines), media_type="text/plain")


# =====================================================================
# EHR / integrations
# =====================================================================


@app.get("/api/integrations")
async def list_integrations() -> dict[str, Any]:
    """List integration adapter types with status and JSON-Schema config schema."""
    return {
        "integrations": [INTEGRATIONS[k] for k in INTEGRATIONS],
        "count": len(INTEGRATIONS),
    }


# =====================================================================
# Local entry point (when run via `python3 main.py`)
# =====================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
