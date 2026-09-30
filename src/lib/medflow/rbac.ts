// MedFlow Transcribe AI — Role-Based Access Control (RBAC) layer.
// ADDITIVE — does not modify existing components; they opt in via useRbac().
//
// Permission model:
//   - Each NAV_ITEM id has a permission key (e.g. "section.jobs").
//   - Each workflow action has a permission key (e.g. "action.approve", "action.deliver").
//   - Roles are granted a Set of permission keys.
//   - Wildcard "*" grants everything (Super Admin).
//
// This file is pure data + helpers — safe to import from both server and client.

import type { Role } from "./types";

export type Permission =
  // Section visibility
  | "section.overview"
  | "section.jobs"
  | "section.queue"
  | "section.upload"
  | "section.documents"
  | "section.clarifications"
  | "section.quality"
  | "section.templates"
  | "section.analytics"
  | "section.agents"
  | "section.integrations"
  | "section.team"
  | "section.billing"
  | "section.audit"
  | "section.settings"
  | "section.rbac" // the Roles & Permissions panel itself
  // New additive sections (Task 11)
  | "section.copilot"
  | "section.compliance"
  | "section.client-portal"
  | "section.mobile-app"
  // Round 2 additive sections
  | "section.streaming"
  | "section.workflow"
  | "section.workforce"
  | "section.smart-fhir"
  | "section.patient-access"
  | "section.sra"
  // Workflow actions
  | "action.upload_dictation"
  | "action.assign"
  | "action.reassign"
  | "action.advance_workflow"
  | "action.run_ai_agent"
  | "action.request_clarification"
  | "action.resolve_clarification"
  | "action.qa_review"
  | "action.qa_reject"
  | "action.provider_approve"
  | "action.provider_sign"
  | "action.deliver"
  | "action.escalate"
  | "action.cancel_job"
  | "action.edit_template"
  | "action.manage_users"
  | "action.manage_integrations"
  | "action.manage_billing"
  | "action.view_audit"
  | "action.export_data"
  | "action.delete_tenant"
  | "*";

export const ROLES: Role[] = [
  "Platform Super Admin",
  "Tenant Owner",
  "Client Operations Manager",
  "Provider",
  "Onsite Coordinator",
  "Offshore Delivery Manager",
  "Transcriptionist",
  "Medical Editor",
  "QA Analyst",
  "Billing User",
  "Auditor / Compliance Officer",
  "Support User",
];

// Map each Role → Set of Permission keys.
// "*" grants every permission (super admin only).
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  "Platform Super Admin": ["*"],
  "Tenant Owner": [
    "section.overview","section.jobs","section.queue","section.upload","section.documents",
    "section.clarifications","section.quality","section.templates","section.analytics",
    "section.agents","section.integrations","section.team","section.billing","section.audit",
    "section.settings","section.rbac",
    "section.copilot","section.compliance","section.client-portal",
    "section.workflow","section.workforce","section.smart-fhir","section.patient-access","section.mobile-app",
    "section.streaming","section.workflow","section.workforce","section.smart-fhir","section.patient-access","section.sra",
    "action.upload_dictation","action.assign","action.reassign","action.advance_workflow",
    "action.run_ai_agent","action.request_clarification","action.resolve_clarification",
    "action.qa_review","action.qa_reject","action.provider_approve","action.provider_sign",
    "action.deliver","action.escalate","action.cancel_job","action.edit_template",
    "action.manage_users","action.manage_integrations","action.manage_billing",
    "action.view_audit","action.export_data","action.delete_tenant",
  ],
  "Client Operations Manager": [
    "section.overview","section.jobs","section.queue","section.documents",
    "section.clarifications","section.quality","section.analytics","section.agents",
    "section.team","section.audit",
    "section.copilot","section.compliance","section.client-portal",
    "section.workflow","section.workforce","section.smart-fhir","section.patient-access",
    "action.assign","action.reassign","action.advance_workflow","action.run_ai_agent",
    "action.request_clarification","action.resolve_clarification","action.qa_review",
    "action.escalate","action.cancel_job","action.view_audit","action.export_data",
  ],
  Provider: [
    "section.overview","section.jobs","section.queue","section.upload","section.documents",
    "section.clarifications","section.quality","section.analytics",
    "section.mobile-app","section.streaming","section.patient-access","section.smart-fhir",
    "action.upload_dictation","action.request_clarification","action.provider_approve",
    "action.provider_sign","action.advance_workflow",
  ],
  "Onsite Coordinator": [
    "section.overview","section.jobs","section.queue","section.clarifications",
    "section.quality","section.analytics","section.agents",
    "section.copilot","section.client-portal","section.workflow","section.streaming",
    "action.assign","action.reassign","action.advance_workflow","action.run_ai_agent",
    "action.request_clarification","action.resolve_clarification","action.escalate",
  ],
  "Offshore Delivery Manager": [
    "section.overview","section.jobs","section.queue","section.quality",
    "section.analytics","section.agents","section.team",
    "section.copilot","section.compliance","section.mobile-app",
    "section.streaming","section.workflow","section.workforce",
    "action.assign","action.reassign","action.advance_workflow","action.run_ai_agent",
    "action.qa_review","action.escalate","action.export_data",
  ],
  Transcriptionist: [
    "section.overview","section.jobs","section.queue","section.documents",
    "section.clarifications","section.streaming","section.workflow",
    "action.advance_workflow","action.request_clarification",
  ],
  "Medical Editor": [
    "section.overview","section.jobs","section.queue","section.documents",
    "section.clarifications","section.quality",
    "action.advance_workflow","action.request_clarification","action.qa_review",
  ],
  "QA Analyst": [
    "section.overview","section.jobs","section.queue","section.quality","section.analytics",
    "section.copilot","section.workflow",
    "action.qa_review","action.qa_reject","action.advance_workflow","action.run_ai_agent",
    "action.request_clarification",
  ],
  "Billing User": [
    "section.overview","section.billing","section.analytics",
    "action.manage_billing","action.export_data",
  ],
  "Auditor / Compliance Officer": [
    "section.overview","section.audit","section.quality","section.analytics",
    "section.compliance","section.sra",
    "action.view_audit","action.export_data",
  ],
  "Support User": [
    "section.overview","section.jobs","section.queue",
    "action.advance_workflow",
  ],
};

// NavItem id → section permission key
export const SECTION_PERMISSIONS: Record<string, Permission> = {
  overview: "section.overview",
  jobs: "section.jobs",
  queue: "section.queue",
  upload: "section.upload",
  documents: "section.documents",
  clarifications: "section.clarifications",
  quality: "section.quality",
  templates: "section.templates",
  analytics: "section.analytics",
  agents: "section.agents",
  integrations: "section.integrations",
  team: "section.team",
  billing: "section.billing",
  audit: "section.audit",
  settings: "section.settings",
  rbac: "section.rbac",
  // New additive sections (Task 11)
  copilot: "section.copilot",
  compliance: "section.compliance",
  "client-portal": "section.client-portal",
  "mobile-app": "section.mobile-app",
  // Round 2
  "streaming": "section.streaming",
  "workflow": "section.workflow",
  "workforce": "section.workforce",
  "smart-fhir": "section.smart-fhir",
  "patient-access": "section.patient-access",
  "sra": "section.sra",
};

// Helper: does a role have a permission? (wildcard support)
export function roleHasPermission(role: Role, perm: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes("*") || perms.includes(perm);
}

// Pretty description for the Roles panel
export const ROLE_DESCRIPTIONS: Record<Role, { scope: string; color: string; icon: string }> = {
  "Platform Super Admin": { scope: "Global platform control — all tenants, plans, security policies", color: "#0B5345", icon: "Crown" },
  "Tenant Owner": { scope: "Full control of their healthcare organization + billing", color: "#0B5345", icon: "Building2" },
  "Client Operations Manager": { scope: "Manages jobs, priorities, SLAs, escalations, offshore performance", color: "#1ABC9C", icon: "Gauge" },
  Provider: { scope: "Uploads dictation, reviews, edits, signs documents", color: "#1ABC9C", icon: "Stethoscope" },
  "Onsite Coordinator": { scope: "Client communication, urgent coordination, missing metadata", color: "#48C9B0", icon: "Headset" },
  "Offshore Delivery Manager": { scope: "Team queues, staffing, productivity, quality thresholds", color: "#48C9B0", icon: "Users" },
  Transcriptionist: { scope: "Receives audio, creates/edits drafts — cannot finalize", color: "#58D68D", icon: "Pencil" },
  "Medical Editor": { scope: "Reviews drafts, corrects grammar/terminology/numbers", color: "#58D68D", icon: "FileEdit" },
  "QA Analyst": { scope: "QA review, records errors, approves or returns for rework", color: "#F4D03F", icon: "ShieldCheck" },
  "Billing User": { scope: "Views usage, invoices, statements, payment history", color: "#E67E22", icon: "CreditCard" },
  "Auditor / Compliance Officer": { scope: "Read-only audit trails, policies, retention, security events", color: "#9B59B6", icon: "ShieldAlert" },
  "Support User": { scope: "Time-bound, tenant-approved, fully-logged support access", color: "#7F8C8D", icon: "LifeBuoy" },
};

// The demo users selectable in the role switcher (name, role, email)
export const DEMO_ROLE_PRESETS: { role: Role; name: string; email: string }[] = [
  { role: "Tenant Owner", name: "Dana Whitfield", email: "dana.whitfield@cardinalhealth.demo" },
  { role: "Client Operations Manager", name: "Marcus Reyes", email: "marcus.reyes@cardinalhealth.demo" },
  { role: "Provider", name: "Dr. Emily Carter", email: "emily.carter@cardinalhealth.demo" },
  { role: "Onsite Coordinator", name: "Aisha Patel", email: "aisha.patel@cardinalhealth.demo" },
  { role: "Offshore Delivery Manager", name: "Vikram Sundaram", email: "vikram.sundaram@offshore.medflow.demo" },
  { role: "Medical Editor", name: "Sara Lin", email: "sara.lin@offshore.medflow.demo" },
  { role: "QA Analyst", name: "Ananya Iyer", email: "ananya.iyer@offshore.medflow.demo" },
  { role: "Billing User", name: "Linda Hoffmann", email: "linda.hoffmann@cardinalhealth.demo" },
  { role: "Auditor / Compliance Officer", name: "Henry Donovan", email: "henry.donovan@cardinalhealth.demo" },
];
