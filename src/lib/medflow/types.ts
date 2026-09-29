// MedFlow Transcribe AI — domain types
// Mirrors the Prisma schema + the FastAPI ai-agents-service contracts.

export type Role =
  | "Platform Super Admin"
  | "Tenant Owner"
  | "Client Operations Manager"
  | "Provider"
  | "Onsite Coordinator"
  | "Offshore Delivery Manager"
  | "Transcriptionist"
  | "Medical Editor"
  | "QA Analyst"
  | "Billing User"
  | "Auditor / Compliance Officer"
  | "Support User";

export type JobStatus =
  | "Draft"
  | "Submitted"
  | "Intake validation"
  | "Awaiting Transcriptionist"
  | "AI Transcription in progress"
  | "AI Draft Ready"
  | "Editing in progress"
  | "Awaiting QA"
  | "QA failed / rework"
  | "Clarification requested"
  | "Awaiting Provider Review"
  | "Approved"
  | "Delivered"
  | "Rejected"
  | "Cancelled"
  | "Escalated";

export type Priority = "Routine" | "Urgent" | "STAT";
export type SlaRisk = "on-track" | "at-risk" | "breach";
export type RiskSeverity = "informational" | "low" | "medium" | "high" | "critical";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  group: "main" | "ops" | "config" | "admin";
  roles?: Role[];
}

export interface Job {
  id: string;
  jobNumber: string;
  status: JobStatus;
  priority: Priority;
  patientRef: string | null;
  encounterRef: string | null;
  providerId: string | null;
  facilityId: string | null;
  departmentId: string | null;
  specialtyId: string | null;
  templateId: string | null;
  documentType: string;
  audioFileName: string | null;
  audioDurationSec: number | null;
  audioSizeBytes: number | null;
  slaDeadline: string | null;
  slaPercent: number | null;
  slaRiskLabel: SlaRisk | null;
  deliveryDest: string | null;
  clientInstructions: string | null;
  transcriptText: string | null;
  structuredDocJson: string | null;
  aiConfidence: number | null;
  qualityScore: number | null;
  riskScore: number | null;
  riskSeverity: RiskSeverity | null;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobWithRelations extends Job {
  provider?: { id: string; name: string; title: string | null } | null;
  facility?: { id: string; name: string; code: string } | null;
  department?: { id: string; name: string } | null;
  specialty?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string; role: string } | null;
  events?: JobEvent[];
  qualityReviews?: QualityReview[];
}

export interface JobEvent {
  id: string;
  jobId: string;
  event: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string | null;
  actorName: string;
  detail: string | null;
  metadataJson: string | null;
  createdAt: string;
}

export interface QualityReview {
  id: string;
  jobId: string;
  reviewerId: string | null;
  qualityScore: number;
  riskScore: number;
  riskSeverity: RiskSeverity;
  recommendedAction: string | null;
  findingsJson: string;
  createdAt: string;
}

export interface ProviderT {
  id: string;
  name: string;
  title: string | null;
  npi: string | null;
}

export interface FacilityT {
  id: string;
  name: string;
  code: string;
}

export interface SpecialtyT {
  id: string;
  name: string;
}

export interface DepartmentT {
  id: string;
  name: string;
}

export interface UserT {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
}

export type AgentCategory = "governance" | "ai" | "orchestration" | "monitoring" | "delivery" | "billing" | "security" | "reporting";
export type AgentStatus = "idle" | "running" | "succeeded" | "failed";

export interface AiAgent {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  status: AgentStatus;
  last_run_at: string | null;
  last_duration_ms: number | null;
  last_cost_usd: number | null;
  success_count: number;
  failure_count: number;
  model: string;
  prompt_version: string;
  supports_human_escalation: boolean;
  input_schema: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  recent_runs?: AgentRun[];
}

export interface AgentRun {
  run_id: string;
  agent_id: string;
  job_id: string;
  correlation_id: string;
  status: AgentStatus;
  started_at: string;
  completed_at: string | null;
  duration_ms: number;
  cost_usd: number;
  output?: Record<string, unknown>;
}

export interface DbConnector {
  id: string;
  label: string;
  engine: string;
  color: string;
  supports: string[];
  connection_string_format: string;
  status: string;
  default?: boolean;
  notes: string;
}

export interface DbTestResult {
  connector: string;
  status: "ok" | "failed";
  latency_ms: number;
  validation_errors: string[];
  tested_at: string;
  recommendation: string;
}

export interface IntegrationConnection {
  id: string;
  type: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
}

export interface AuditEvent {
  id: string;
  actorName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  severity: "info" | "warning" | "critical";
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  detail: string;
  status: "open" | "acknowledged" | "resolved";
  createdAt: string;
}
