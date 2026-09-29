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
import re
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
# === TASK 11-a ADDITIONS — AI Operations Copilot, Medical Entity    ===
# === Extraction, Hallucination Guard, FHIR Subscriptions,          ===
# === DirectTrust Secure Messaging.                                 ===
# ===                                                               ===
# === All endpoints below are SIMULATED / MOCK for demo purposes.   ===
# === A real production deployment would call actual clinical NLP /  ===
# === STT models, LLMs, and DirectTrust trust anchors. They are     ===
# === purely ADDITIVE — no existing route is modified.              ===
# ===                                                               ===
# === NOTE ON ROUTE ORDER: The new GET /api/fhir/subscription       ===
# === route is declared BEFORE the existing dynamic GET /api/fhir/  ===
# === {job_id} route. Starlette matches routes in declaration       ===
# === order; if we appended the new GET at the end, the existing    ===
# === /api/fhir/{job_id} would capture "/api/fhir/subscription"     ===
# === (job_id="subscription") and 404. Declaring it first lets the   ===
# === exact-match path win, and the existing dynamic route still    ===
# === works for every other job_id.                                 ===
# =====================================================================

# --- Module-level stores (in-memory, additive) ---
COPILOT_CACHE: dict[str, dict[str, Any]] = {}         # date → last copilot summary
FHIR_SUBSCRIPTIONS: dict[str, dict[str, Any]] = {}    # subscription id → subscription object
DIRECT_LOG: list[dict[str, Any]] = []                 # log of sent Direct messages (cap 100)

# --- Synthetic SLA risk metadata for seeded jobs (deterministic demo) ---
# (SEED_JOBS doesn't carry live workflow status; this metadata is what an
#  actual workflow DB would expose — used only by the Operations Copilot.)
JOB_SLA_META: dict[str, dict[str, Any]] = {
    "JOB-2024-001": {"status": "Transcribing", "sla_percent": 0.78, "sla_risk_label": "at-risk",  "priority": "STAT"},
    "JOB-2024-002": {"status": "QA Review",    "sla_percent": 0.42, "sla_risk_label": "on-track", "priority": "normal"},
    "JOB-2024-003": {"status": "Delivered",    "sla_percent": 1.00, "sla_risk_label": "on-track", "priority": "normal"},
    "JOB-2024-004": {"status": "Escalated",    "sla_percent": 0.96, "sla_risk_label": "breach",   "priority": "urgent"},
    "JOB-2024-005": {"status": "Queued",       "sla_percent": 0.10, "sla_risk_label": "on-track", "priority": "normal"},
    "JOB-2024-006": {"status": "Transcribing", "sla_percent": 0.65, "sla_risk_label": "at-risk",  "priority": "STAT"},
}

# --- Clinical NLP knowledge base (built-in mock maps; NOT an LLM) ---
# (Term lookups are case-insensitive — the helper lowercases the input.)
SNOMED_CT_MAP: dict[str, tuple[str, str]] = {
    "chest pain":               ("29857009",  "Chest pain (finding)"),
    "hypertension":             ("38341003",  "Hypertension (disorder)"),
    "diabetes mellitus":        ("73211009",  "Diabetes mellitus (disorder)"),
    "diabetes":                 ("73211009",  "Diabetes mellitus (disorder)"),
    "myocardial infarction":    ("22298006",  "Myocardial infarction (disorder)"),
    "heart failure":            ("56265001",  "Heart failure (disorder)"),
    "atrial fibrillation":      ("49436004",  "Atrial fibrillation (disorder)"),
    "coronary artery disease":  ("53741008",  "Coronary artery disease (disorder)"),
    "cad":                      ("53741008",  "Coronary artery disease (disorder)"),
    "dyspnea":                  ("267038007", "Dyspnea (finding)"),
    "shortness of breath":      ("267038007", "Dyspnea (finding)"),
    "edema":                    ("76571002",  "Edema (finding)"),
    "copd":                     ("13645005",  "Chronic obstructive lung disease (disorder)"),
    "migraine":                 ("37799009",  "Migraine (disorder)"),
}

ICD10_MAP: dict[str, tuple[str, str]] = {
    "hypertension":             ("I10",     "Essential (primary) hypertension"),
    "diabetes mellitus":        ("E11.9",   "Type 2 diabetes mellitus without complications"),
    "diabetes":                 ("E11.9",   "Type 2 diabetes mellitus without complications"),
    "myocardial infarction":    ("I21.9",   "Acute myocardial infarction, unspecified"),
    "heart failure":            ("I50.9",   "Heart failure, unspecified"),
    "atrial fibrillation":      ("I48.91",  "Atrial fibrillation and atrial flutter, unspecified"),
    "coronary artery disease":  ("I25.10",  "Atherosclerotic heart disease of native coronary artery without angina pectoris"),
    "cad":                      ("I25.10",  "Atherosclerotic heart disease of native coronary artery without angina pectoris"),
    "chest pain":               ("R07.9",   "Chest pain, unspecified"),
    "dyspnea":                  ("R06.02",   "Shortness of breath"),
    "shortness of breath":      ("R06.02",   "Shortness of breath"),
    "edema":                    ("R60.9",   "Edema, unspecified"),
    "copd":                     ("J44.9",   "COPD (chronic obstructive pulmonary disease), unspecified"),
    "migraine":                 ("G43.909", "Migraine, unspecified, intractable, without status migrainosus"),
}

RXNORM_MAP: dict[str, tuple[str, str]] = {
    "lisinopril":   ("29046",   "Lisinopril 10 MG Oral Tablet"),
    "metoprolol":   ("866426",  "Metoprolol Tartrate 25 MG Oral Tablet"),
    "atorvastatin": ("259255",  "Atorvastatin 20 MG Oral Tablet"),
    "furosemide":   ("314431",  "Furosemide 20 MG Oral Tablet"),
    "warfarin":     ("11240",   "Warfarin 5 MG Oral Tablet"),
    "aspirin":      ("1191",    "Aspirin 81 MG Oral Tablet"),
    "metformin":    ("86009",   "Metformin 500 MG Oral Tablet"),
    "amlodipine":   ("89602",   "Amlodipine 5 MG Oral Tablet"),
}

CPT_MAP: dict[str, tuple[str, str]] = {
    "echo":         ("93306", "Echocardiography, transthoracic, real-time with image documentation (93306)"),
    "ecg":          ("93000", "Electrocardiogram, routine ECG with at least 12 leads (93000)"),
    "ekg":          ("93000", "Electrocardiogram, routine ECG with at least 12 leads (93000)"),
    "office visit": ("99213", "Office visit, established patient, low-to-moderate MDM (99213)"),
    "follow-up":    ("99213", "Office visit, established patient (99213)"),
    "follow up":    ("99213", "Office visit, established patient (99213)"),
    "consultation": ("99243", "Office consultation, low MDM (99243)"),
    "stress test":  ("93350", "Stress echocardiography, complete (93350)"),
}

# ISMP-style error-prone abbreviations the hallucination guard flags.
UNSUPPORTED_ABBREVIATIONS: list[str] = ["q.d.", "QD", "Q.O.D.", "QOD", "cc", "U", "IU", "MS", "MSO4", "MgSO4", "ug", "μg"]

# Body parts for laterality-conflict detection.
LATERALITY_BODY_PARTS: list[str] = [
    "knee", "shoulder", "hip", "ankle", "wrist", "elbow", "hand", "foot",
    "arm", "leg", "ear", "eye", "breast", "kidney", "lung",
]


# --- Pydantic models for new endpoints ---


class CopilotRequest(BaseModel):
    """Body for POST /api/copilot/summarize."""

    date: Optional[str] = Field(None, description="ISO date for the operations summary; defaults to today (UTC)")
    manager_role: Optional[str] = Field(None, description='Manager role label; defaults to "Offshore Delivery Manager"')


class EntityExtractionRequest(BaseModel):
    """Body for POST /api/entities/extract."""

    text: str = Field(..., description="Clinical narrative text to extract entities from")
    document_type: Optional[str] = Field(None, description="Optional document type hint (e.g. soap, operative, discharge)")


class HallucinationRequest(BaseModel):
    """Body for POST /api/hallucination/detect."""

    text: str = Field(..., description="Transcript text to scan for hallucination / fabrication patterns")
    transcript: Optional[str] = Field(None, description="Optional raw transcript if `text` is the structured doc")
    audio_duration_sec: Optional[float] = Field(None, description="Optional audio duration in seconds")


class FhirSubscriptionCreateRequest(BaseModel):
    """Body for POST /api/fhir/subscription."""

    criteria: str = Field(..., description='FHIR Subscription.criteria (e.g. "DocumentReference?status=current")')
    channel_type: str = Field("rest-hook", description="Channel: rest-hook | websocket | email")
    endpoint: str = Field(..., description="Endpoint URL or address")
    reason: str = Field(..., description="Human-readable reason for the subscription")


class FhirSubscriptionFireRequest(BaseModel):
    """Body for POST /api/fhir/subscription/{id}/fire."""

    job_id: str = Field(..., description="Job id that triggered the fire")


class DirectSendRequest(BaseModel):
    """Body for POST /api/direct/send."""

    job_id: str = Field(..., description="Source transcription job id")
    recipient_address: str = Field(..., description='Direct address, e.g. "name@domain.direct"')
    recipient_name: Optional[str] = Field(None, description="Display name of recipient")
    document_summary: Optional[str] = Field(None, description="Short description of the attached document")
    attachment_format: Optional[str] = Field("pdf", description="Attachment format: pdf | ccda | fhir")


# --- Helper functions for new endpoints ---


def _seed_fhir_subscriptions() -> None:
    """Seed the FHIR_SUBSCRIPTIONS store with 3 demo subscriptions on startup."""
    if FHIR_SUBSCRIPTIONS:
        return
    now = _now_iso()
    FHIR_SUBSCRIPTIONS["sub-rest-001"] = {
        "id": "sub-rest-001",
        "status": "active",
        "criteria": "DocumentReference?status=current&category=clinical-note",
        "channel_type": "rest-hook",
        "endpoint": "https://ehr.cardinalhealth.org/fhir/Subscription/notify",
        "reason": "Auto-deliver finalized SOAP notes to Cardinal Health EHR",
        "expiry": "2025-12-31T23:59:59Z",
        "created_at": now,
        "last_fired": None,
        "fired_count": 0,
    }
    FHIR_SUBSCRIPTIONS["sub-ws-001"] = {
        "id": "sub-ws-001",
        "status": "active",
        "criteria": "DocumentReference?status=current&type=11506-3",
        "channel_type": "websocket",
        "endpoint": "wss://portal.medflow.local/notifications/docref",
        "reason": "Push new docrefs into the MedFlow customer portal notifications panel",
        "expiry": "2026-06-30T23:59:59Z",
        "created_at": now,
        "last_fired": None,
        "fired_count": 0,
    }
    FHIR_SUBSCRIPTIONS["sub-email-001"] = {
        "id": "sub-email-001",
        "status": "active",
        "criteria": "DocumentReference?status=current&category=discharge-summary",
        "channel_type": "email",
        "endpoint": "mailto:care-coordination@cardinalhealth.org",
        "reason": "Notify care coordination team on new discharge summaries",
        "expiry": "2025-09-30T23:59:59Z",
        "created_at": now,
        "last_fired": None,
        "fired_count": 0,
    }


def _seed_direct_log() -> None:
    """Seed the DIRECT_LOG with one historical message so the log isn't empty on first GET."""
    if DIRECT_LOG:
        return
    DIRECT_LOG.append({
        "message_id": f"direct-{uuid.uuid4().hex[:12]}",
        "from_address": "medflow@cardinalhealth.direct",
        "to_address": "dr.carter@cardinalhealth.direct",
        "recipient_name": "Dr. Emily Carter",
        "job_id": "JOB-2024-001",
        "document_summary": "Cardiology follow-up SOAP note (historical seed)",
        "attachment_format": "pdf",
        "sent_at": _now_iso(),
        "status": "delivered",
        "smime_signed": True,
        "trust_anchor_validated": True,
        "latency_ms": 156,
        "response": "250 OK message accepted for delivery",
    })


# Run both seeders eagerly so the in-memory state is non-empty even before the
# first request hits the new endpoints.
_seed_fhir_subscriptions()
_seed_direct_log()


def _scan_terms(text_lower: str, term_map: dict[str, tuple[str, str]]) -> list[dict[str, Any]]:
    """Scan text for known clinical terms; return {code, display, confidence, matched_term} entries."""
    out: list[dict[str, Any]] = []
    for term, (code, display) in term_map.items():
        if term in text_lower:
            # Confidence is slightly higher for longer matches (less ambiguity).
            conf = round(min(0.99, 0.82 + 0.012 * len(term)), 3)
            out.append({
                "code": code,
                "display": display,
                "confidence": conf,
                "matched_term": term,
            })
    return out


def _extract_laterality_flags(text_lower: str) -> list[dict[str, Any]]:
    """Detect left/right/bilateral body part mentions."""
    flags: list[dict[str, Any]] = []
    for part in LATERALITY_BODY_PARTS:
        for side in ("left", "right", "bilateral"):
            pattern = rf"\b{side}\s+{part}\b"
            m = re.search(pattern, text_lower)
            if m:
                flags.append({
                    "term": m.group(0),
                    "side": side,
                    "confidence": 0.93 if side == "bilateral" else 0.90,
                })
    return flags


def _extract_negation_flags(text_lower: str) -> list[dict[str, Any]]:
    """Detect 'no X', 'denies X', 'without X' patterns for clinical symptoms."""
    flags: list[dict[str, Any]] = []
    # Curated list of clinically-meaningful negation patterns.
    patterns: list[tuple[str, str]] = [
        (r"\bno chest pain\b",            "chest pain"),
        (r"\bdenies chest pain\b",         "chest pain"),
        (r"\bwithout chest pain\b",        "chest pain"),
        (r"\bno dyspnea\b",                "dyspnea"),
        (r"\bdenies dyspnea\b",            "dyspnea"),
        (r"\bno shortness of breath\b",    "shortness of breath"),
        (r"\bdenies shortness of breath\b", "shortness of breath"),
        (r"\bno edema\b",                  "edema"),
        (r"\bdenies edema\b",              "edema"),
        (r"\bno fever\b",                  "fever"),
        (r"\bdenies fever\b",              "fever"),
        (r"\bno cough\b",                  "cough"),
        (r"\bdenies cough\b",              "cough"),
    ]
    seen: set[str] = set()
    for pat, term in patterns:
        if term in seen:
            continue
        if re.search(pat, text_lower):
            flags.append({
                "term": term,
                "negated": True,
                "confidence": 0.92,
            })
            seen.add(term)
    return flags


def _extract_uncertain_markers(text: str) -> list[str]:
    """Find bracketed uncertainty tokens like [INAUDIBLE], [UNCLEAR]."""
    markers: list[str] = []
    for m in re.finditer(r"\[(?:INAUDIBLE|UNCLEAR|INDETERMINATE|UNINTELLIGIBLE|GAP)\]", text, flags=re.IGNORECASE):
        markers.append(m.group(0))
    return markers


def _extract_allergies(text_lower: str) -> list[str]:
    """Extract plain-string allergies from patterns like 'allergy to penicillin' / 'allergic to ...'."""
    allergies: list[str] = []
    for m in re.finditer(r"\b(?:allergy to|allergic to)\s+([a-z0-9\- ]+?)(?:\.|,|;| and |$)", text_lower):
        substance = m.group(1).strip().rstrip(",.")
        if substance:
            allergies.append(substance)
    return allergies


# --- Hallucination guard helpers ---


def _detect_medication_conflicts(text_lower: str) -> list[dict[str, Any]]:
    """
    Detect same drug mentioned with different doses.
    e.g. "lisinopril 10mg" and "lisinopril 20mg" → conflict.
    """
    conflicts: list[dict[str, Any]] = []
    for drug in RXNORM_MAP.keys():
        # Find all "<drug> <number><unit>" occurrences.
        pattern = rf"\b{re.escape(drug)}\s+(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|units?|iu)\b"
        matches = list(re.finditer(pattern, text_lower))
        if len(matches) >= 2:
            doses = {(m.group(1), m.group(2)) for m in matches}
            if len(doses) >= 2:
                first, last = matches[0], matches[-1]
                conflicts.append({
                    "type": "medication_conflict",
                    "severity": "high",
                    "segment": text_lower[first.start():last.end()],
                    "start_char": first.start(),
                    "end_char": last.end(),
                    "explanation": f"{drug.title()} mentioned with multiple distinct doses: {sorted(doses)}.",
                    "recommendation": f"Confirm the correct {drug} dose with the provider before submission.",
                })
    return conflicts


def _detect_laterality_conflicts(text_lower: str) -> list[dict[str, Any]]:
    """Detect 'left X' then 'right X' for the same body part within the same document."""
    conflicts: list[dict[str, Any]] = []
    for part in LATERALITY_BODY_PARTS:
        left_matches = list(re.finditer(rf"\bleft\s+{part}\b", text_lower))
        right_matches = list(re.finditer(rf"\bright\s+{part}\b", text_lower))
        if left_matches and right_matches:
            start = min(left_matches[0].start(), right_matches[0].start())
            end = max(left_matches[-1].end(), right_matches[-1].end())
            conflicts.append({
                "type": "laterality_conflict",
                "severity": "high",
                "segment": text_lower[start:end],
                "start_char": start,
                "end_char": end,
                "explanation": f"Both 'left {part}' and 'right {part}' appear in the same document — possible laterality error.",
                "recommendation": f"Verify which {part} the provider intended and reconcile the transcript.",
            })
    return conflicts


def _detect_negation_conflicts(text_lower: str) -> list[dict[str, Any]]:
    """Detect 'denies X' / 'no X' followed by 'reports X' / 'complains of X' for the same symptom."""
    conflicts: list[dict[str, Any]] = []
    negation_patterns = [r"\bno\s+{}\b", r"\bdenies\s+{}\b", r"\bwithout\s+{}\b", r"\bnegative\s+for\s+{}\b"]
    assertion_patterns = [r"\breports\s+{}\b", r"\bcomplains\s+of\s+{}\b", r"\bendorses\s+{}\b", r"\bpositive\s+for\s+{}\b"]
    symptoms = ["chest pain", "dyspnea", "shortness of breath", "edema", "fever", "cough"]
    for symptom in symptoms:
        esc = re.escape(symptom)
        neg_hit = None
        for tmpl in negation_patterns:
            m = re.search(tmpl.format(esc), text_lower)
            if m:
                neg_hit = m
                break
        if not neg_hit:
            continue
        pos_hit = None
        for tmpl in assertion_patterns:
            m = re.search(tmpl.format(esc), text_lower)
            if m:
                pos_hit = m
                break
        if pos_hit:
            start = min(neg_hit.start(), pos_hit.start())
            end = max(neg_hit.end(), pos_hit.end())
            conflicts.append({
                "type": "negation_conflict",
                "severity": "critical",
                "segment": text_lower[start:end],
                "start_char": start,
                "end_char": end,
                "explanation": f"'{symptom}' is both denied and affirmed in the same document — possible hallucination.",
                "recommendation": f"Listen to the source audio around the '{symptom}' mentions and reconcile.",
            })
    return conflicts


def _detect_unsupported_abbreviations(text: str) -> list[dict[str, Any]]:
    """Flag ISMP-style error-prone abbreviations (case-sensitive)."""
    flags: list[dict[str, Any]] = []
    for abbr in UNSUPPORTED_ABBREVIATIONS:
        for m in re.finditer(rf"(?<!\w){re.escape(abbr)}(?!\w)", text):
            flags.append({
                "type": "unsupported_abbreviation",
                "severity": "medium",
                "segment": text[m.start():m.end()],
                "start_char": m.start(),
                "end_char": m.end(),
                "explanation": f"Abbreviation '{abbr}' is on the ISMP error-prone abbreviation list.",
                "recommendation": "Replace with the full word form (e.g. 'unit', 'daily', 'international unit').",
            })
    return flags


def _detect_numeric_inconsistencies(text_lower: str) -> list[dict[str, Any]]:
    """Detect numeric inconsistencies (e.g. same vital/lab mentioned with different values)."""
    flags: list[dict[str, Any]] = []
    # Look for "BP <num>/<num>" pattern repeated with different values.
    bp_matches = list(re.finditer(r"\bbp\s+(\d{2,3})\s*[/\\]\s*(\d{2,3})\b", text_lower))
    if len(bp_matches) >= 2:
        vals = {(m.group(1), m.group(2)) for m in bp_matches}
        if len(vals) >= 2:
            first, last = bp_matches[0], bp_matches[-1]
            flags.append({
                "type": "numeric_inconsistency",
                "severity": "medium",
                "segment": text_lower[first.start():last.end()],
                "start_char": first.start(),
                "end_char": last.end(),
                "explanation": f"Blood pressure documented with multiple distinct values: {sorted(vals)}.",
                "recommendation": "Reconcile the most recent BP value with the source audio.",
            })
    # Look for HR <num> repeated.
    hr_matches = list(re.finditer(r"\bhr\s+(\d{1,3})\b", text_lower))
    if len(hr_matches) >= 2:
        vals = {m.group(1) for m in hr_matches}
        if len(vals) >= 2:
            first, last = hr_matches[0], hr_matches[-1]
            flags.append({
                "type": "numeric_inconsistency",
                "severity": "low",
                "segment": text_lower[first.start():last.end()],
                "start_char": first.start(),
                "end_char": last.end(),
                "explanation": f"Heart rate documented with multiple distinct values: {sorted(vals)}.",
                "recommendation": "Reconcile the most recent HR value with the source audio.",
            })
    return flags


def _detect_unsupported_claims(text_lower: str) -> list[dict[str, Any]]:
    """Flag rare / unsupported medical claims (heuristic mock)."""
    flags: list[dict[str, Any]] = []
    suspicious_patterns = [
        (r"\b100\s*%\s*cure\b",            "claim of 100% cure"),
        (r"\bmiracle\s+cure\b",            "claim of miracle cure"),
        (r"\bguaranteed\s+no\s+recurrence\b", "guaranteed no recurrence claim"),
    ]
    for pattern, label in suspicious_patterns:
        for m in re.finditer(pattern, text_lower):
            flags.append({
                "type": "unsupported_claim",
                "severity": "high",
                "segment": text_lower[m.start():m.end()],
                "start_char": m.start(),
                "end_char": m.end(),
                "explanation": f"Document contains unsupported claim: {label}.",
                "recommendation": "Remove or substantiate the claim with a citation before submission.",
            })
    # Flag [INAUDIBLE] adjacent to a confident statement.
    inaudible_idx = text_lower.find("[inaudible]")
    if inaudible_idx >= 0:
        window = text_lower[max(0, inaudible_idx - 80):inaudible_idx + 80]
        if any(w in window for w in ("confirmed", "definitely", "no doubt", "clear that")):
            flags.append({
                "type": "unsupported_claim",
                "severity": "medium",
                "segment": text_lower[inaudible_idx:inaudible_idx + 11],
                "start_char": inaudible_idx,
                "end_char": inaudible_idx + 11,
                "explanation": "[INAUDIBLE] marker adjacent to a confident statement — the confident claim may have been fabricated over an inaudible region.",
                "recommendation": "Listen to the audio around the [INAUDIBLE] marker and confirm or remove the confident statement.",
            })
    return flags


def _compute_risk_level(flags: list[dict[str, Any]]) -> tuple[float, str]:
    """Map flags to (overall_risk_score 0-1, risk_level)."""
    if not flags:
        return 0.05, "low"
    weight = {"low": 0.10, "medium": 0.25, "high": 0.45, "critical": 0.65}
    score = sum(weight.get(f["severity"], 0.10) for f in flags)
    score = min(1.0, round(score, 3))
    if score >= 0.85:
        level = "critical"
    elif score >= 0.55:
        level = "high"
    elif score >= 0.25:
        level = "medium"
    else:
        level = "low"
    return score, level


# =====================================================================
# 1. AI Operations Copilot — POST /api/copilot/summarize  (A1)
# =====================================================================


@app.post("/api/copilot/summarize")
async def copilot_summarize(body: CopilotRequest) -> dict[str, Any]:
    """
    Generate an AI Operations Copilot summary for a given date (SIMULATED).

    Production would call an LLM (e.g. GPT-4 / Claude / GLM-4) with the live
    workflow DB + SLA metrics; here we deterministically aggregate
    SEED_JOBS + JOB_SLA_META so the summary is realistic + reproducible.
    """
    # Resolve date (default = today UTC).
    if body.date:
        date_str = body.date
    else:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    manager_role = body.manager_role or "Offshore Delivery Manager"

    # Build a per-job enriched view that combines SEED_JOBS + JOB_SLA_META.
    enriched: list[dict[str, Any]] = []
    for job_id, job in SEED_JOBS.items():
        meta = JOB_SLA_META.get(job_id, {})
        enriched.append({
            "job_id": job_id,
            "job_number": f"MF-2024-{job_id.rsplit('-', 1)[-1]}",
            "specialty": job.get("specialty", "Unknown"),
            "priority": meta.get("priority", job.get("priority", "normal")),
            "status": meta.get("status", "Unknown"),
            "sla_percent": meta.get("sla_percent", 0.0),
            "sla_risk_label": meta.get("sla_risk_label", "on-track"),
        })

    # Compute the daily backlog risk aggregates.
    total_in_pipeline = sum(1 for j in enriched if j["status"] != "Delivered")
    at_risk_count = sum(1 for j in enriched if j["sla_risk_label"] == "at-risk")
    breach_count = sum(1 for j in enriched if j["sla_risk_label"] == "breach")
    stat_jobs = sum(1 for j in enriched if j["priority"] == "STAT")
    escalated_count = sum(1 for j in enriched if j["status"] == "Escalated")

    # SLA breach predictions: pick from at-risk + breach jobs (max 5).
    breach_candidates = [j for j in enriched if j["sla_risk_label"] in ("at-risk", "breach")]
    breach_candidates.sort(key=lambda j: j["sla_percent"], reverse=True)
    sla_breach_predictions: list[dict[str, Any]] = []
    for j in breach_candidates[:5]:
        remaining_hours = max(0.0, round((1.0 - j["sla_percent"]) * 24.0, 1))
        # Recommend action by severity + priority.
        if j["sla_risk_label"] == "breach":
            action = "escalate"
            confidence = 0.94
        elif j["priority"] == "STAT":
            action = "expedite"
            confidence = 0.88
        elif j["sla_percent"] >= 0.7:
            action = "notify_client"
            confidence = 0.79
        else:
            action = "reassign"
            confidence = 0.72
        sla_breach_predictions.append({
            "job_id": j["job_id"],
            "job_number": j["job_number"],
            "current_status": j["status"],
            "sla_percent": round(j["sla_percent"], 2),
            "predicted_breach_in_hours": remaining_hours,
            "confidence": confidence,
            "recommended_action": action,
        })

    # High rework items (mock realistic values).
    high_rework_items = [
        {"type": "provider",  "name": "Dr. Synthetic Cardiologist", "rework_rate_pct": 18.5, "job_count": 2},
        {"type": "template",  "name": "Cardiology SOAP v2",         "rework_rate_pct": 12.3, "job_count": 4},
        {"type": "specialty", "name": "Orthopedics",                "rework_rate_pct": 22.1, "job_count": 1},
        {"type": "template",  "name": "Operative Note (Ortho)",      "rework_rate_pct": 16.7, "job_count": 1},
    ]

    # Staffing recommendation (mock).
    staffing_recommendation = {
        "current_load": total_in_pipeline,
        "recommended_shift_adjustment": "+1 evening shift (16:00-00:00 UTC) for STAT backlog",
        "surplus_deficit": -2,  # negative = deficit
    }

    # 3-paragraph markdown client ops report draft.
    predictions_inline = ", ".join(
        f"{p['job_number']} ({p['predicted_breach_in_hours']}h, {p['recommended_action']})"
        for p in sla_breach_predictions
    ) or "none"
    client_ops_report_draft = (
        f"# Client Operations Report — {date_str}\n\n"
        f"## 1. Pipeline Overview\n"
        f"Cardinal Health Systems — daily transcription operations report for {date_str}. "
        f"Active pipeline volume is {total_in_pipeline} jobs, of which {at_risk_count} are "
        f"flagged at-risk and {breach_count} have breached SLA. {stat_jobs} STAT-priority "
        f"jobs remain in flight, and {escalated_count} job is currently in Escalated status. "
        f"Overall throughput is below the contractual target and warrants immediate intervention.\n\n"
        f"## 2. SLA Risk & Predicted Breaches\n"
        f"Based on the current SLA window consumption, the following jobs are predicted to "
        f"breach within the next 24 hours: {predictions_inline}. "
        f"Recommended actions include shift reassignment, STAT expedite, and proactive "
        f"client notification. The high-rework providers / templates listed above should be "
        f"routed to senior QA for the next 48 hours to bring the rework rate under control.\n\n"
        f"## 3. Staffing & Next Steps\n"
        f"Current offshore load is {staffing_recommendation['current_load']} jobs with a "
        f"surplus / deficit of {staffing_recommendation['surplus_deficit']} FTE. We recommend "
        f"{staffing_recommendation['recommended_shift_adjustment']}. {manager_role} will "
        f"follow up with the on-site team lead before 09:00 UTC tomorrow. No raw PHI was "
        f"used in this aggregate report."
    )

    summary = {
        "date": date_str,
        "manager_role": manager_role,
        "daily_backlog_risk": {
            "total_in_pipeline": total_in_pipeline,
            "at_risk_count": at_risk_count,
            "breach_count": breach_count,
            "stat_jobs": stat_jobs,
            "escalated_count": escalated_count,
        },
        "sla_breach_predictions": sla_breach_predictions,
        "high_rework_items": high_rework_items,
        "staffing_recommendation": staffing_recommendation,
        "client_ops_report_draft": client_ops_report_draft,
        "generated_at": _now_iso(),
        "data_minimized": True,
    }

    COPILOT_CACHE[date_str] = summary
    logger.info(
        "copilot summary generated date=%s predictions=%d",
        date_str,
        len(sla_breach_predictions),
    )
    return summary


# =====================================================================
# 2. Medical Entity Extraction + Auto-Coding — POST /api/entities/extract  (A3)
# =====================================================================


@app.post("/api/entities/extract")
async def extract_entities(body: EntityExtractionRequest) -> dict[str, Any]:
    """
    SIMULATED clinical NLP entity extraction + auto-coding.

    Production would call a fine-tuned clinical NLP model (BioBERT /
    scispaCy / BioGPT) with UMLS / SNOMED-CT / ICD-10 / CPT / RxNorm
    lexicon matching. Here we use deterministic keyword + regex matching
    against built-in maps so the response is realistic + reproducible.
    """
    text = body.text or ""
    text_lower = text.lower()

    if len(text.strip()) < 5:
        return {
            "snomed_ct": [],
            "icd10": [],
            "cpt": [],
            "rxnorm": [],
            "medications": [],
            "diagnoses": [],
            "allergies": [],
            "laterality_flags": [],
            "negation_flags": [],
            "uncertain_markers": [],
            "model": "medflow-cnl-v1.0.0",
            "prompt_version": "v1.0.0",
            "extracted_at": _now_iso(),
            "disclaimer": "Auto-suggested codes for editor review. Not auto-applied. Editor must verify before submission.",
            "document_type_hint": body.document_type,
            "note": "Input text too short — no entities extracted.",
        }

    snomed = _scan_terms(text_lower, SNOMED_CT_MAP)
    icd10 = _scan_terms(text_lower, ICD10_MAP)
    cpt = _scan_terms(text_lower, CPT_MAP)
    rxnorm = _scan_terms(text_lower, RXNORM_MAP)

    # Plain-string arrays (deduped, preserve insertion order).
    medications: list[str] = []
    for term in RXNORM_MAP.keys():
        if term in text_lower and term not in medications:
            medications.append(term)
    diagnoses: list[str] = []
    for term in SNOMED_CT_MAP.keys():
        if term in text_lower and term not in diagnoses:
            diagnoses.append(term)

    allergies = _extract_allergies(text_lower)
    laterality_flags = _extract_laterality_flags(text_lower)
    negation_flags = _extract_negation_flags(text_lower)
    uncertain_markers = _extract_uncertain_markers(text)

    return {
        "snomed_ct": snomed,
        "icd10": icd10,
        "cpt": cpt,
        "rxnorm": rxnorm,
        "medications": medications,
        "diagnoses": diagnoses,
        "allergies": allergies,
        "laterality_flags": laterality_flags,
        "negation_flags": negation_flags,
        "uncertain_markers": uncertain_markers,
        "model": "medflow-cnl-v1.0.0",
        "prompt_version": "v1.0.0",
        "extracted_at": _now_iso(),
        "disclaimer": "Auto-suggested codes for editor review. Not auto-applied. Editor must verify before submission.",
        "document_type_hint": body.document_type,
    }


# =====================================================================
# 3. Hallucination Detection — POST /api/hallucination/detect  (A4)
# =====================================================================


@app.post("/api/hallucination/detect")
async def detect_hallucinations(body: HallucinationRequest) -> dict[str, Any]:
    """
    SIMULATED hallucination / fabrication guardrail.

    Production would call a domain-specific model that cross-references
    the source transcript's low-confidence regions against the structured
    document; here we use deterministic pattern matching for common
    LLM / STT failure modes (medication conflicts, laterality conflicts,
    negation conflicts, unsupported abbreviations, numeric inconsistencies,
    unsupported claims).
    """
    text = body.text or ""
    text_lower = text.lower()

    flags: list[dict[str, Any]] = []
    flags.extend(_detect_medication_conflicts(text_lower))
    flags.extend(_detect_laterality_conflicts(text_lower))
    flags.extend(_detect_negation_conflicts(text_lower))
    flags.extend(_detect_unsupported_abbreviations(text))
    flags.extend(_detect_numeric_inconsistencies(text_lower))
    flags.extend(_detect_unsupported_claims(text_lower))

    overall_score, risk_level = _compute_risk_level(flags)

    return {
        "flags": flags,
        "overall_risk_score": overall_score,
        "risk_level": risk_level,
        "model": "medflow-hallucination-guard-v1.0.0",
        "audio_duration_sec": body.audio_duration_sec,
        "checked_at": _now_iso(),
        "disclaimer": "AI guardrail output — not a substitute for clinical review. All flags require editor verification.",
    }


# =====================================================================
# 4. FHIR Subscriptions — GET / POST / DELETE + fire  (C2)
#
# NOTE: this group is declared BEFORE the existing GET /api/fhir/{job_id}
# route below — see the file-top comment for the routing-order rationale.
# =====================================================================


@app.get("/api/fhir/subscription")
async def list_fhir_subscriptions() -> dict[str, Any]:
    """List all FHIR Subscriptions (in-memory store seeded with 3 demo entries)."""
    subs = list(FHIR_SUBSCRIPTIONS.values())
    return {
        "subscriptions": subs,
        "count": len(subs),
    }


@app.post("/api/fhir/subscription")
async def create_fhir_subscription(body: FhirSubscriptionCreateRequest) -> dict[str, Any]:
    """Create a new FHIR Subscription (SIMULATED — in-memory only)."""
    sub_id = f"sub-rest-{uuid.uuid4().hex[:8]}"
    now = _now_iso()
    subscription = {
        "id": sub_id,
        "status": "active",
        "criteria": body.criteria,
        "channel_type": body.channel_type,
        "endpoint": body.endpoint,
        "reason": body.reason,
        "expiry": "2026-12-31T23:59:59Z",
        "created_at": now,
        "last_fired": None,
        "fired_count": 0,
    }
    FHIR_SUBSCRIPTIONS[sub_id] = subscription
    logger.info("fhir subscription created id=%s criteria=%s", sub_id, body.criteria)
    return subscription


@app.post("/api/fhir/subscription/{sub_id}/fire")
async def fire_fhir_subscription(sub_id: str, body: FhirSubscriptionFireRequest) -> dict[str, Any]:
    """Simulate firing a FHIR Subscription for a delivered job."""
    if sub_id not in FHIR_SUBSCRIPTIONS:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"Unknown subscription id '{sub_id}'",
                "correlation_id": _generate_correlation_id(),
            },
        )
    sub = FHIR_SUBSCRIPTIONS[sub_id]
    if sub.get("status") not in ("active",):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "subscription_not_active",
                "message": f"Subscription '{sub_id}' is not active (status={sub.get('status')}).",
                "correlation_id": _generate_correlation_id(),
            },
        )
    # Simulate webhook delivery latency 80-400ms.
    latency_ms = random.randint(80, 400)
    await asyncio.sleep(latency_ms / 1000.0)
    now = _now_iso()
    sub["last_fired"] = now
    sub["fired_count"] = (sub.get("fired_count") or 0) + 1
    logger.info(
        "fhir subscription fired id=%s job=%s latency=%dms",
        sub_id,
        body.job_id,
        latency_ms,
    )
    return {
        "subscription_id": sub_id,
        "job_id": body.job_id,
        "fired_at": now,
        "response_code": 200,
        "latency_ms": latency_ms,
        "status": "delivered",
    }


@app.delete("/api/fhir/subscription/{sub_id}")
async def cancel_fhir_subscription(sub_id: str) -> dict[str, Any]:
    """Cancel a FHIR Subscription (sets status to 'off')."""
    if sub_id not in FHIR_SUBSCRIPTIONS:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "not_found",
                "message": f"Unknown subscription id '{sub_id}'",
                "correlation_id": _generate_correlation_id(),
            },
        )
    sub = FHIR_SUBSCRIPTIONS[sub_id]
    sub["status"] = "off"
    logger.info("fhir subscription cancelled id=%s", sub_id)
    return {
        "id": sub_id,
        "status": "off",
        "cancelled_at": _now_iso(),
    }


# =====================================================================
# 5. DirectTrust Secure Messaging — POST /api/direct/send + GET /api/direct/log  (C5)
# =====================================================================

# Direct address pattern: name@domain.direct OR name@hie.org
_DIRECT_ADDRESS_RE = re.compile(
    r"^[A-Za-z0-9._%+\-]+@(?:[A-Za-z0-9.\-]+\.direct|hie\.org)$"
)


@app.post("/api/direct/send")
async def direct_send(body: DirectSendRequest) -> dict[str, Any]:
    """
    SIMULATED DirectTrust secure messaging send (S/MIME-signed).

    Production would look up the recipient's X.509 certificate in the
    Direct trust anchor bundle, S/MIME-sign + encrypt the message, and
    send via the configured SMTP smart host. Here we validate the address
    pattern and simulate SMTP-like latency + response.
    """
    recipient = body.recipient_address or ""
    # Simulate network latency 100-400ms.
    latency_ms = random.randint(100, 400)
    await asyncio.sleep(latency_ms / 1000.0)

    # Failure conditions: address contains "fail" OR doesn't match the pattern.
    failed = False
    reason = ""
    if "fail" in recipient.lower():
        failed = True
        reason = "Recipient address explicitly marked as failing (contains 'fail')."
    elif not _DIRECT_ADDRESS_RE.match(recipient):
        failed = True
        reason = (
            f"Recipient address '{recipient}' does not match the Direct address "
            "pattern (name@domain.direct or name@hie.org)."
        )

    msg_id = f"direct-{uuid.uuid4().hex[:12]}"
    now = _now_iso()

    if failed:
        record = {
            "message_id": msg_id,
            "from_address": "medflow@cardinalhealth.direct",
            "to_address": recipient,
            "recipient_name": body.recipient_name,
            "job_id": body.job_id,
            "document_summary": body.document_summary,
            "attachment_format": body.attachment_format,
            "sent_at": now,
            "status": "failed",
            "smime_signed": True,
            "trust_anchor_validated": True,
            "latency_ms": latency_ms,
            "response": f"550 5.1.2 recipient address rejected: {reason}",
            "error_reason": reason,
        }
    else:
        record = {
            "message_id": msg_id,
            "from_address": "medflow@cardinalhealth.direct",
            "to_address": recipient,
            "recipient_name": body.recipient_name,
            "job_id": body.job_id,
            "document_summary": body.document_summary,
            "attachment_format": body.attachment_format,
            "sent_at": now,
            "status": "delivered",
            "smime_signed": True,
            "trust_anchor_validated": True,
            "latency_ms": latency_ms,
            "response": "250 OK message accepted for delivery",
        }

    DIRECT_LOG.append(record)
    if len(DIRECT_LOG) > 100:
        del DIRECT_LOG[: len(DIRECT_LOG) - 100]
    logger.info(
        "direct send job=%s recipient=%s status=%s",
        body.job_id,
        recipient,
        record["status"],
    )
    return record


@app.get("/api/direct/log")
async def direct_log() -> dict[str, Any]:
    """Return the in-memory log of sent Direct messages (most recent first)."""
    return {
        "messages": list(reversed(DIRECT_LOG)),
        "count": len(DIRECT_LOG),
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
