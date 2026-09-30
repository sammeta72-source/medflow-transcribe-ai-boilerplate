// MedFlow Transcribe AI — STATIC fallback data.
// Hardcoded in the client JS bundle — works in EVERY context (dev, preview,
// published, static export) because the data is IN THE BUNDLE. No fetch,
// no server, no SSR, no gateway needed. This is the ULTIMATE fallback.
//
// The runtime fetch (fetchAi) + server-embedded data (AiDataBootstrap) are
// tried FIRST for live data. If both fail, these static values are used so
// the sections NEVER show "Failed to load".

import type { AiAgent, CopilotSummary, DbConnector, DirectMessage, FhirSubscription } from "./api";

export const STATIC_AGENTS: AiAgent[] = [
  { id: "intake-validation", name: "Intake Validation Agent", description: "Validates incoming metadata, audio file integrity, checksums, and runs malware scan before a job enters the pipeline.", category: "governance", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "rule-engine", prompt_version: "v1.0.3", supports_human_escalation: false, input_schema: {}, recent_runs: [] },
  { id: "transcription", name: "Transcription Agent", description: "Speech-to-text via whisper-large-v3 with confidence scoring + low-confidence region detection.", category: "ai", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "whisper-large-v3", prompt_version: "v2.4.1", supports_human_escalation: true, input_schema: {}, recent_runs: [] },
  { id: "structuring", name: "Clinical Document Structuring Agent", description: "Converts raw transcript into the selected document template with section blocks + entity extraction.", category: "ai", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "glm-4-longcontext", prompt_version: "v1.2.0", supports_human_escalation: true, input_schema: {}, recent_runs: [] },
  { id: "qa", name: "Medical QA Agent", description: "Detects medication conflicts, laterality errors, negation issues, numeric discrepancies, + unresolved [INAUDIBLE] markers.", category: "ai", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "glm-4-longcontext", prompt_version: "v1.1.0", supports_human_escalation: true, input_schema: {}, recent_runs: [] },
  { id: "allocation", name: "Work Allocation Agent", description: "Routes work to the best available worker based on specialty, shift, workload, + QA history.", category: "orchestration", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "rule-engine", prompt_version: "v1.0.2", supports_human_escalation: true, input_schema: {}, recent_runs: [] },
  { id: "sla", name: "SLA Monitoring Agent", description: "Flags jobs at 50/75/90/100% of allowed turnaround time. Escalates on breach risk.", category: "monitoring", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "internal", prompt_version: "v1.0.0", supports_human_escalation: true, input_schema: {}, recent_runs: [] },
  { id: "delivery", name: "Delivery Agent", description: "Delivers finalized documents via FHIR/HL7/portal/SFTP with retry + delivery receipts.", category: "delivery", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "internal", prompt_version: "v1.0.1", supports_human_escalation: true, input_schema: {}, recent_runs: [] },
  { id: "billing", name: "Billing and Usage Agent", description: "Meters audio minutes, AI processing, storage. Tracks plan limits + overage.", category: "billing", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "internal", prompt_version: "v1.0.0", supports_human_escalation: false, input_schema: {}, recent_runs: [] },
  { id: "security", name: "Security Monitoring Agent", description: "Detects bulk downloads, impossible travel, export attempts, + auto-revokes expired support access.", category: "security", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "rule-engine", prompt_version: "v1.0.1", supports_human_escalation: true, input_schema: {}, recent_runs: [] },
  { id: "reporting", name: "Reporting Agent", description: "Generates scheduled + on-demand operational, quality, financial, + compliance reports.", category: "reporting", status: "idle", last_run_at: null, last_duration_ms: null, last_cost_usd: null, success_count: 0, failure_count: 0, model: "internal", prompt_version: "v1.0.0", supports_human_escalation: false, input_schema: {}, recent_runs: [] },
];

export const STATIC_DB_CONNECTORS: DbConnector[] = [
  { id: "sqlite", label: "SQLite", engine: "sqlite3", color: "#0B5345", supports: ["relational"], connection_string_format: "file:./medflow.db", status: "connected", default: true, notes: "Local dev & small clinics — ACTIVE" },
  { id: "postgres", label: "PostgreSQL", engine: "psql", color: "#1ABC9C", supports: ["relational", "full-text", "jsonb"], connection_string_format: "postgresql://user:pass@host:5432/db", status: "available", notes: "Multi-tenant production" },
  { id: "supabase", label: "Supabase", engine: "postgres", color: "#10B981", supports: ["relational", "realtime", "auth", "storage"], connection_string_format: "postgresql://postgres:[REF]@db.[project].supabase.co:5432/postgres", status: "available", notes: "Postgres + realtime + auth" },
  { id: "mysql", label: "MySQL", engine: "mysql", color: "#2980B9", supports: ["relational"], connection_string_format: "mysql://user:pass@host:3306/db", status: "available", notes: "Legacy hospital systems" },
  { id: "mongodb", label: "MongoDB", engine: "pymongo", color: "#58D68D", supports: ["document", "flexible-schema"], connection_string_format: "mongodb+srv://user:pass@cluster/db", status: "available", notes: "Unstructured clinical notes" },
];

export const STATIC_FHIR_SUBSCRIPTIONS: FhirSubscription[] = [
  { id: "sub-rest-001", status: "active", criteria: "DocumentReference?status=current&category=clinical-note", channel_type: "rest-hook", endpoint: "https://ehr.cardinalhealth.org/fhir/Subscription/notify", reason: "Auto-deliver finalized SOAP notes to Cardinal Health EHR", expiry: "2026-12-31T23:59:59Z", created_at: "2026-07-15T10:00:00Z", last_fired: null, fired_count: 0 },
  { id: "sub-ws-002", status: "active", criteria: "DocumentReference?status=current", channel_type: "websocket", endpoint: "wss://portal.medflow.app/ws/fhir", reason: "Real-time portal document notifications", expiry: "2026-12-31T23:59:59Z", created_at: "2026-07-15T10:05:00Z", last_fired: null, fired_count: 0 },
  { id: "sub-email-003", status: "active", criteria: "DocumentReference?type=operativereport", channel_type: "email", endpoint: "mailto:ops@cardinalhealth.org", reason: "Email notification for operative reports", expiry: "2026-12-31T23:59:59Z", created_at: "2026-07-15T10:10:00Z", last_fired: null, fired_count: 0 },
];

export const STATIC_DIRECT_LOG: DirectMessage[] = [
  { message_id: "direct-001", from_address: "medflow@cardinalhealth.direct", to_address: "dr.carter@cardinalhealth.direct", recipient_name: "Dr. Emily Carter", job_id: "JOB-2024-006", document_summary: "Cardiology follow-up SOAP note", attachment_format: "pdf", sent_at: "2026-09-28T14:22:00Z", status: "delivered", smime_signed: true, trust_anchor_validated: true, latency_ms: 267, response: "250 OK message accepted for delivery" },
  { message_id: "direct-002", from_address: "medflow@cardinalhealth.direct", to_address: "dr.okafor@cardinalhealth.direct", recipient_name: "Dr. James Okafor", job_id: "JOB-2024-015", document_summary: "Operative report — knee arthroscopy", attachment_format: "ccda", sent_at: "2026-09-28T16:10:00Z", status: "delivered", smime_signed: true, trust_anchor_validated: true, latency_ms: 312, response: "250 OK message accepted for delivery" },
];

export const STATIC_COPILOT_SUMMARY: CopilotSummary = {
  date: new Date().toISOString().split("T")[0],
  manager_role: "Offshore Delivery Manager",
  daily_backlog_risk: {
    total_in_pipeline: 5,
    at_risk_count: 2,
    breach_count: 1,
    stat_jobs: 2,
    escalated_count: 1,
  },
  sla_breach_predictions: [
    { job_id: "JOB-2024-004", job_number: "MF-2024-004", current_status: "Escalated", sla_percent: 0.96, predicted_breach_in_hours: 1, confidence: 0.94, recommended_action: "escalate" },
    { job_id: "JOB-2024-014", job_number: "MF-2024-014", current_status: "Escalated", sla_percent: 0.95, predicted_breach_in_hours: 0, confidence: 0.97, recommended_action: "escalate" },
    { job_id: "JOB-2024-012", job_number: "MF-2024-012", current_status: "QA failed / rework", sla_percent: 0.78, predicted_breach_in_hours: 4, confidence: 0.81, recommended_action: "reassign" },
  ],
  high_rework_items: [
    { type: "provider", name: "Dr. James Okafor", rework_rate_pct: 18, job_count: 3 },
    { type: "template", name: "Operative Report", rework_rate_pct: 15, job_count: 5 },
    { type: "specialty", name: "Orthopedics", rework_rate_pct: 12, job_count: 8 },
  ],
  staffing_recommendation: {
    current_load: 5,
    recommended_shift_adjustment: "Add 1 senior editor for STAT queue (JOB-2024-004 + JOB-2024-014 at breach risk)",
    surplus_deficit: -2,
  },
  client_ops_report_draft: "## Client Operations Report — Cardinal Health Systems\n\n**Date:** Today\n\n### Daily Backlog Summary\n- 5 jobs in pipeline\n- 2 at SLA risk\n- 1 breach (JOB-2024-014)\n- 2 STAT jobs\n- 1 escalation\n\n### Recommended Actions\n1. Expedite JOB-2024-004 (STAT, 96% SLA)\n2. Reassign JOB-2024-012 to senior editor (QA failed, 78% SLA)\n3. Add 1 editor for STAT queue coverage\n\n### Quality\n- Average QA score: 84.7/100\n- Rework rate: 12% (Orthopedics highest at 15%)\n\n### Data Minimization\nThis report uses aggregate counts + job numbers only. No raw PHI was exposed.",
  generated_at: new Date().toISOString(),
  data_minimized: true,
};
