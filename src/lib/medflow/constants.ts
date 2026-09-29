// MedFlow Transcribe AI — static constants (nav, kanban columns, plans, templates)

import type { JobStatus, NavItem, Priority, RiskSeverity, SlaRisk } from "./types";

export const APP_NAME = "MedFlow Transcribe AI";
export const APP_TAGLINE =
  "Secure AI-assisted medical transcription operations for healthcare organizations and managed offshore delivery teams.";
export const POSITIONING =
  "MedFlow Transcribe AI helps healthcare organizations and transcription service teams securely transform clinical dictation into review-ready documentation — using AI automation, human quality control, SLA intelligence, and EHR-ready delivery.";

// FastAPI ai-agents-service port (called via Caddy gateway with ?XTransformPort=8000)
export const AGENTS_PORT = 8000;
export const agentsUrl = (path: string) => `/api${path}?XTransformPort=${AGENTS_PORT}`;

// ── Navigation ────────────────────────────────────────────────────────────
export const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: "LayoutDashboard", group: "main" },
  { id: "jobs", label: "Jobs (Kanban)", icon: "KanbanSquare", group: "main" },
  { id: "queue", label: "My Queue", icon: "Inbox", group: "main" },
  { id: "upload", label: "Upload Dictation", icon: "Upload", group: "main" },
  { id: "documents", label: "Documents", icon: "FileText", group: "main" },
  { id: "clarifications", label: "Clarifications", icon: "MessageCircleQuestion", group: "main" },
  { id: "quality", label: "Quality", icon: "ShieldCheck", group: "ops" },
  { id: "templates", label: "Templates", icon: "FileStack", group: "ops" },
  { id: "analytics", label: "Analytics", icon: "BarChart3", group: "ops" },
  { id: "agents", label: "AI Agents", icon: "Bot", group: "ops" },
  { id: "integrations", label: "Integrations", icon: "Plug", group: "config" },
  { id: "team", label: "Team", icon: "Users", group: "config" },
  { id: "billing", label: "Billing", icon: "CreditCard", group: "config" },
  { id: "audit", label: "Audit & Security", icon: "ShieldAlert", group: "admin" },
  { id: "settings", label: "Settings", icon: "Settings", group: "admin" },
];

export const NAV_GROUPS: { id: NavItem["group"]; label: string }[] = [
  { id: "main", label: "Workspace" },
  { id: "ops", label: "Operations" },
  { id: "config", label: "Configuration" },
  { id: "admin", label: "Administration" },
];

// ── Kanban columns ─────────────────────────────────────────────────────────
// Each column maps to a JobStatus and gets an accent color (from Image-2 spectrum).
export interface KanbanColumn {
  id: string;
  label: string;
  statuses: JobStatus[];
  accent: string; // tailwind utility class for the right tab color (.mf-tab-yellow…pink)
  icon: string;
  help: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "intake", label: "Intake", statuses: ["Draft", "Submitted", "Intake validation"], accent: "mf-tab-yellow", icon: "Inbox", help: "Newly uploaded dictations pending validation" },
  { id: "ai", label: "AI Processing", statuses: ["Awaiting Transcriptionist", "AI Transcription in progress", "AI Draft Ready"], accent: "mf-tab-orange", icon: "Bot", help: "AI Transcription + Structuring agents" },
  { id: "editing", label: "Human Editing", statuses: ["Editing in progress", "Clarification requested", "QA failed / rework"], accent: "mf-tab-brown", icon: "Pencil", help: "Transcriptionist / Medical Editor workspace" },
  { id: "qa", label: "QA Review", statuses: ["Awaiting QA"], accent: "mf-tab-green", icon: "ShieldCheck", help: "QA Analyst review queue" },
  { id: "provider", label: "Provider Review", statuses: ["Awaiting Provider Review", "Approved"], accent: "mf-tab-teal", icon: "Stethoscope", help: "Provider review & electronic signature" },
  { id: "delivered", label: "Delivered", statuses: ["Delivered"], accent: "mf-tab-blue", icon: "Send", help: "FHIR / HL7 / Portal / SFTP delivery complete" },
  { id: "exceptions", label: "Exceptions", statuses: ["Escalated", "Rejected", "Cancelled"], accent: "mf-tab-pink", icon: "AlertTriangle", help: "Escalations, rejections, cancellations" },
];

// ── Priority + risk styling ───────────────────────────────────────────────
export const PRIORITY_STYLES: Record<Priority, { badge: string; dot: string }> = {
  Routine: { badge: "bg-muted text-foreground border-border", dot: "bg-slate-400" },
  Urgent: { badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200", dot: "bg-amber-500" },
  STAT: { badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200", dot: "bg-red-500" },
};

export const SLA_RISK_STYLES: Record<SlaRisk, { label: string; badge: string; ring: string }> = {
  "on-track": { label: "On Track", badge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200", ring: "ring-emerald-300" },
  "at-risk": { label: "At Risk", badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200", ring: "ring-amber-300" },
  breach: { label: "Breach", badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200", ring: "ring-red-300" },
};

export const RISK_SEVERITY_STYLES: Record<RiskSeverity, { badge: string; dot: string; label: string }> = {
  informational: { badge: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-400", label: "Informational" },
  low: { badge: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300", dot: "bg-emerald-500", label: "Low" },
  medium: { badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200", dot: "bg-amber-500", label: "Medium" },
  high: { badge: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200", dot: "bg-orange-500", label: "High" },
  critical: { badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200", dot: "bg-red-500", label: "Critical" },
};

// ── Status → column helper ─────────────────────────────────────────────────
export function columnForStatus(status: JobStatus): KanbanColumn {
  return KANBAN_COLUMNS.find(c => c.statuses.includes(status)) ?? KANBAN_COLUMNS[0];
}

// ── Status metadata (color + next-status progression) ──────────────────────
export const STATUS_META: Record<JobStatus, { color: string; label: string; description: string }> = {
  Draft: { color: "#7F8C8D", label: "Draft", description: "Provider started dictation, not yet submitted." },
  Submitted: { color: "#F4D03F", label: "Submitted", description: "Dictation submitted; awaiting intake validation." },
  "Intake validation": { color: "#F4D03F", label: "Intake Validation", description: "Intake Validation Agent checking metadata, checksum, malware." },
  "Awaiting Transcriptionist": { color: "#E67E22", label: "Awaiting Transcriptionist", description: "Validated; Work Allocation Agent selecting a worker." },
  "AI Transcription in progress": { color: "#E67E22", label: "AI Transcription", description: "Transcription Agent (whisper-large-v3) processing audio." },
  "AI Draft Ready": { color: "#E67E22", label: "AI Draft Ready", description: "Structured draft produced; awaiting human editor." },
  "Editing in progress": { color: "#8B7355", label: "Editing in progress", description: "Transcriptionist / Medical Editor correcting the draft." },
  "Awaiting QA": { color: "#58D68D", label: "Awaiting QA", description: "Edited draft submitted to QA Analyst." },
  "QA failed / rework": { color: "#8B7355", label: "QA failed / rework", description: "QA rejected; routed back to editor." },
  "Clarification requested": { color: "#8B7355", label: "Clarification requested", description: "Query to provider; SLA timer paused." },
  "Awaiting Provider Review": { color: "#48C9B0", label: "Awaiting Provider Review", description: "Provider must review, edit, approve, or sign." },
  Approved: { color: "#48C9B0", label: "Approved", description: "Provider electronic signature captured; locked." },
  Delivered: { color: "#2980B9", label: "Delivered", description: "Delivery Agent delivered via FHIR / HL7 / Portal / SFTP." },
  Rejected: { color: "#C0392B", label: "Rejected", description: "Provider rejected; routed back for correction." },
  Cancelled: { color: "#7F8C8D", label: "Cancelled", description: "Job cancelled by user or admin." },
  Escalated: { color: "#EB984E", label: "Escalated", description: "Escalated to Operations Manager; SLA breach." },
};

// ── SaaS plans ─────────────────────────────────────────────────────────────
export interface SaasPlan {
  id: string;
  name: string;
  target: string;
  pricePerMonth: number;
  audioMinutes: number;
  seats: number;
  storageGb: number;
  features: string[];
  highlight?: boolean;
}

export const SAAS_PLANS: SaasPlan[] = [
  {
    id: "starter",
    name: "Starter",
    target: "Small clinics & individual provider groups",
    pricePerMonth: 149,
    audioMinutes: 500,
    seats: 5,
    storageGb: 25,
    features: ["Dictation upload", "AI drafts", "Basic templates", "Basic analytics", "Email support"],
  },
  {
    id: "professional",
    name: "Professional",
    target: "Multi-provider clinics & transcription companies",
    pricePerMonth: 499,
    audioMinutes: 5000,
    seats: 50,
    storageGb: 200,
    features: ["Everything in Starter", "Workflow routing", "QA & team queues", "Advanced analytics", "Branded client portal", "API access", "FHIR/HL7 delivery"],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    target: "Hospitals, health systems, large BPOs",
    pricePerMonth: 0, // custom
    audioMinutes: -1, // unlimited
    seats: -1,
    storageGb: -1,
    features: ["Everything in Professional", "SSO / SAML", "Custom retention policies", "Advanced integrations", "Dedicated environments", "Custom SLA rules", "Enterprise audit controls", "24/7 support + BAA"],
  },
];

// ── Document templates library ─────────────────────────────────────────────
export const DOCUMENT_TEMPLATES = [
  { name: "SOAP Note", type: "SOAP Note", sections: ["Subjective", "Objective", "Assessment", "Plan"], desc: "Subjective, Objective, Assessment, Plan — the standard outpatient note.", icon: "ClipboardList" },
  { name: "Consultation Note", type: "Consultation Note", sections: ["Reason for Consult", "History", "Examination", "Impression", "Recommendation"], desc: "Specialty consult with structured recommendations.", icon: "Users" },
  { name: "History & Physical", type: "H&P", sections: ["Chief Complaint", "HPI", "Past History", "Social History", "ROS", "Physical Exam", "Assessment", "Plan"], desc: "Comprehensive admission H&P.", icon: "FileText" },
  { name: "Operative Report", type: "Operative Report", sections: ["Pre-op Diagnosis", "Post-op Diagnosis", "Procedure", "Surgeon", "Anesthesia", "Findings", "Closure"], desc: "Surgical operative report.", icon: "Scissors" },
  { name: "Discharge Summary", type: "Discharge Summary", sections: ["Admission Diagnoses", "Discharge Diagnoses", "Hospital Course", "Discharge Medications", "Follow-up"], desc: "Hospital discharge summary.", icon: "FileOutput" },
  { name: "Radiology Report", type: "Radiology Report", sections: ["Exam", "Indication", "Comparison", "Findings", "Impression"], desc: "Radiology study report.", icon: "ScanLine" },
  { name: "Procedure Note", type: "Procedure Note", sections: ["Indication", "Consent", "Procedure", "Complications", "Estimated Blood Loss"], desc: "Bedside procedure note.", icon: "Stethoscope" },
  { name: "Follow-up Note", type: "Follow-up Note", sections: ["Interval History", "Examination", "Assessment", "Plan"], desc: "Outpatient follow-up visit note.", icon: "CalendarClock" },
];

// ── Demo credentials (for display only — auth is mock) ────────────────────
export const DEMO_USERS = [
  { role: "Tenant Owner", email: "dana.whitfield@cardinalhealth.demo", name: "Dana Whitfield" },
  { role: "Provider", email: "emily.carter@cardinalhealth.demo", name: "Dr. Emily Carter" },
  { role: "Medical Editor", email: "sara.lin@offshore.medflow.demo", name: "Sara Lin" },
  { role: "QA Analyst", email: "ananya.iyer@offshore.medflow.demo", name: "Ananya Iyer" },
  { role: "Offshore Delivery Manager", email: "vikram.sundaram@offshore.medflow.demo", name: "Vikram Sundaram" },
];

// ── Roadmap (for Landing/Settings) ─────────────────────────────────────────
export const ROADMAP = [
  { phase: "MVP", status: "complete", items: ["Multi-tenant onboarding", "Secure audio intake", "AI transcription + structuring", "Human editor + QA workflow", "Provider approval & delivery", "Basic analytics", "Audit trail"] },
  { phase: "v1", status: "in-progress", items: ["Stripe billing + usage metering", "EHR adapters (Epic/Cerner)", "FHIR DocumentReference export", "HL7 v2 MDM message export", "SFTP delivery adapter", "Notification center", "Super-admin console"] },
  { phase: "Enterprise", status: "planned", items: ["SSO / SAML", "Custom retention + legal holds", "AI Operations Copilot", "Predictive SLA breach", "Bulk import/export", "Dedicated tenant environments", "BAA + audit evidence export"] },
];
