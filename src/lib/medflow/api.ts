// MedFlow Transcribe AI — API client (Next.js route handlers + FastAPI proxy).
// All FastAPI calls go through the Next.js catch-all proxy at /api/ai/<path>,
// which forwards to http://localhost:8000/api/<path> server-side. This works
// whether the app is accessed via the Caddy gateway (port 81) OR the Next.js
// dev server directly (port 3000) — fixing the previous "Failed to load" 404s.

import type { AiAgent, AgentRun, DbConnector, DbTestResult } from "./types";

// Build a URL rooted at the Next.js proxy. Keeps the old `agentsUrl` import
// working for any external callers, but our own functions use the proxy.
function aiUrl(path: string): string {
  return `/api/ai${path}`;
}

// Backward-compatible export (some section components may still import agentsUrl).
export const agentsUrl = aiUrl;

const AGENT_RUN_STORE_KEY = "medflow.agent.runs.v1";

// ── LocalStorage-backed cache for agent runs (so UI persists across reloads) ─
function loadRuns(): Record<string, AgentRun[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(AGENT_RUN_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveRuns(runs: Record<string, AgentRun[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AGENT_RUN_STORE_KEY, JSON.stringify(runs));
  } catch {
    /* ignore */
  }
}

export function getLocalAgentRuns(agentId: string): AgentRun[] {
  return loadRuns()[agentId] ?? [];
}

// ── FastAPI calls (with client-side retry on 5xx + network errors) ───────────
// The Next.js proxy at /api/ai/<path> already retries upstream failures, but we
// add a second client-side retry layer so a cold-start, first-compile latency
// (Next.js dev server takes 7+ seconds to compile a route on first hit), or a
// transient network blip never surfaces as a hard "Failed to load" in the UI.
// 5 attempts with exponential backoff (1s, 2s, 4s, 8s) = up to 15s total — covers
// the first-compile window + service restarts.

async function fetchWithRetry(input: string, init?: RequestInit, attempts = 5): Promise<Response> {
  let lastErr: Error | null = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000); // 30s per attempt
      const res = await fetch(input, { ...init, cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      // Retry on 5xx (server errors) OR 502/504 from the proxy — these are transient.
      if ((res.status >= 500 || res.status === 0) && i < attempts) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i - 1))); // 1s, 2s, 4s, 8s
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < attempts) {
        // Network error / abort / timeout — retry with exponential backoff
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i - 1)));
      }
    }
  }
  throw lastErr ?? new Error("fetch failed after retries");
}

export async function fetchAgents(): Promise<AiAgent[]> {
  const res = await fetchWithRetry(agentsUrl("/agents"));
  if (!res.ok) throw new Error(`fetchAgents failed: ${res.status}`);
  const data = await res.json();
  const agents: AiAgent[] = data.agents ?? [];
  // Merge locally-stored runs so the UI reflects what we triggered from the browser
  const local = loadRuns();
  return agents.map(a => ({ ...a, recent_runs: [...(local[a.id] ?? []), ...(a.recent_runs ?? [])].slice(0, 5) }));
}

export async function fetchAgent(agentId: string): Promise<AiAgent | null> {
  try {
    const res = await fetchWithRetry(agentsUrl(`/agents/${agentId}`));
    if (!res.ok) return null;
    const a: AiAgent = await res.json();
    const local = loadRuns();
    return { ...a, recent_runs: [...(local[a.id] ?? []), ...(a.recent_runs ?? [])].slice(0, 5) };
  } catch {
    return null;
  }
}

export async function runAgent(
  agentId: string,
  jobId: string,
  tenantId = "org_demo",
): Promise<AgentRun> {
  const correlationId = `corr-${Math.random().toString(36).slice(2, 11)}`;
  const res = await fetchWithRetry(
    agentsUrl(`/agents/${agentId}/run`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, tenant_id: tenantId, correlation_id: correlationId }),
    },
  );
  if (!res.ok) throw new Error(`runAgent failed: ${res.status}`);
  const run: AgentRun = await res.json();
  // Persist locally so the UI keeps the run even after re-fetching the agent list
  const local = loadRuns();
  const list = local[agentId] ?? [];
  local[agentId] = [run, ...list].slice(0, 10);
  saveRuns(local);
  return run;
}

export async function fetchDbConnectors(): Promise<DbConnector[]> {
  const res = await fetchWithRetry(agentsUrl("/db/connectors"));
  if (!res.ok) throw new Error(`fetchDbConnectors failed: ${res.status}`);
  const data = await res.json();
  return data.connectors ?? [];
}

export async function testDbConnector(
  connector: string,
  connectionString: string,
): Promise<DbTestResult> {
  const res = await fetchWithRetry(
    agentsUrl("/db/connectors/test"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector, connection_string: connectionString }),
    },
  );
  if (!res.ok) throw new Error(`testDbConnector failed: ${res.status}`);
  return res.json();
}

export async function switchDbConnector(
  connector: string,
  connectionString: string,
): Promise<{ active_connector: string; switched_at: string; migrated_tables: number; status: string }> {
  const res = await fetchWithRetry(
    agentsUrl(`/db/connectors/${connector}/switch`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection_string: connectionString }),
    },
  );
  if (!res.ok) throw new Error(`switchDbConnector failed: ${res.status}`);
  return res.json();
}

export async function fetchFhir(jobId: string): Promise<Record<string, unknown>> {
  const res = await fetchWithRetry(agentsUrl(`/fhir/${jobId}`));
  if (!res.ok) throw new Error(`fetchFhir failed: ${res.status}`);
  return res.json();
}

export async function fetchHl7(jobId: string): Promise<string> {
  const res = await fetchWithRetry(agentsUrl(`/hl7/${jobId}`));
  if (!res.ok) throw new Error(`fetchHl7 failed: ${res.status}`);
  const data = await res.json();
  return data.message ?? data.hl7 ?? JSON.stringify(data, null, 2);
}

// ── New additive features (Task 11) — FastAPI-backed via the /api/ai proxy ──

// A1 — AI Operations Copilot
export interface CopilotSummary {
  date: string;
  manager_role: string;
  daily_backlog_risk: {
    total_in_pipeline: number;
    at_risk_count: number;
    breach_count: number;
    stat_jobs: number;
    escalated_count: number;
  };
  sla_breach_predictions: Array<{
    job_id: string;
    job_number: string;
    current_status: string;
    sla_percent: number;
    predicted_breach_in_hours: number;
    confidence: number;
    recommended_action: string;
  }>;
  high_rework_items: Array<{
    type: "provider" | "template" | "specialty";
    name: string;
    rework_rate_pct: number;
    job_count: number;
  }>;
  staffing_recommendation: {
    current_load: number;
    recommended_shift_adjustment: string;
    surplus_deficit: number;
  };
  client_ops_report_draft: string;
  generated_at: string;
  data_minimized: boolean;
}

export async function fetchCopilotSummary(
  managerRole = "Offshore Delivery Manager",
): Promise<CopilotSummary> {
  const res = await fetchWithRetry(
    agentsUrl("/copilot/summarize"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_role: managerRole }),
    },
  );
  if (!res.ok) throw new Error(`fetchCopilotSummary failed: ${res.status}`);
  return res.json();
}

// A3 — Medical Entity Extraction + Auto-Coding
export interface ExtractedEntities {
  snomed_ct: Array<{ code: string; display: string; confidence: number; matched_term: string }>;
  icd10: Array<{ code: string; display: string; confidence: number }>;
  cpt: Array<{ code: string; display: string; confidence: number }>;
  rxnorm: Array<{ code: string; display: string; confidence: number }>;
  medications: string[];
  diagnoses: string[];
  allergies: string[];
  laterality_flags: Array<{ term: string; side: string; confidence: number }>;
  negation_flags: Array<{ term: string; negated: boolean; confidence: number }>;
  uncertain_markers: string[];
  model: string;
  prompt_version: string;
  extracted_at: string;
  disclaimer: string;
}

export async function extractEntities(text: string, documentType?: string): Promise<ExtractedEntities> {
  const res = await fetchWithRetry(
    agentsUrl("/entities/extract"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, document_type: documentType }),
    },
  );
  if (!res.ok) throw new Error(`extractEntities failed: ${res.status}`);
  return res.json();
}

// A4 — Hallucination Detection
export interface HallucinationFlag {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  segment: string;
  start_char: number;
  end_char: number;
  explanation: string;
  recommendation: string;
}

export interface HallucinationResult {
  flags: HallucinationFlag[];
  overall_risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  model: string;
  checked_at: string;
  disclaimer: string;
}

export async function detectHallucinations(
  text: string,
  transcript?: string,
  audioDurationSec?: number,
): Promise<HallucinationResult> {
  const res = await fetchWithRetry(
    agentsUrl("/hallucination/detect"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, transcript, audio_duration_sec: audioDurationSec }),
    },
  );
  if (!res.ok) throw new Error(`detectHallucinations failed: ${res.status}`);
  return res.json();
}

// C2 — FHIR Subscriptions
export interface FhirSubscription {
  id: string;
  status: "active" | "error" | "off";
  criteria: string;
  channel_type: "rest-hook" | "websocket" | "email";
  endpoint: string;
  reason: string;
  expiry: string;
  created_at: string;
  last_fired: string | null;
  fired_count: number;
}

export async function fetchFhirSubscriptions(): Promise<FhirSubscription[]> {
  const res = await fetchWithRetry(agentsUrl("/fhir/subscription"));
  if (!res.ok) throw new Error(`fetchFhirSubscriptions failed: ${res.status}`);
  const data = await res.json();
  return data.subscriptions ?? [];
}

export async function createFhirSubscription(
  criteria: string,
  channel_type: string,
  endpoint: string,
  reason: string,
): Promise<FhirSubscription> {
  const res = await fetchWithRetry(
    agentsUrl("/fhir/subscription"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria, channel_type, endpoint, reason }),
    },
  );
  if (!res.ok) throw new Error(`createFhirSubscription failed: ${res.status}`);
  return res.json();
}

export async function fireFhirSubscription(
  subscriptionId: string,
  jobId: string,
): Promise<{ subscription_id: string; job_id: string; fired_at: string; response_code: number; latency_ms: number; status: string }> {
  const res = await fetchWithRetry(
    agentsUrl(`/fhir/subscription/${subscriptionId}/fire`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
    },
  );
  if (!res.ok) throw new Error(`fireFhirSubscription failed: ${res.status}`);
  return res.json();
}

export async function deleteFhirSubscription(subscriptionId: string): Promise<{ ok: boolean }> {
  const res = await fetchWithRetry(
    agentsUrl(`/fhir/subscription/${subscriptionId}`),
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`deleteFhirSubscription failed: ${res.status}`);
  return { ok: true };
}

// C5 — DirectTrust Secure Messaging
export interface DirectMessage {
  message_id: string;
  from_address: string;
  to_address: string;
  recipient_name: string;
  job_id: string;
  document_summary: string;
  attachment_format: string;
  sent_at: string;
  status: "delivered" | "failed";
  smime_signed: boolean;
  trust_anchor_validated: boolean;
  latency_ms: number;
  response: string;
}

export async function sendDirectMessage(
  jobId: string,
  recipientAddress: string,
  recipientName: string,
  documentSummary?: string,
  attachmentFormat: "pdf" | "ccda" | "fhir" = "pdf",
): Promise<DirectMessage> {
  const res = await fetchWithRetry(
    agentsUrl("/direct/send"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        recipient_address: recipientAddress,
        recipient_name: recipientName,
        document_summary: documentSummary,
        attachment_format: attachmentFormat,
      }),
    },
  );
  if (!res.ok) throw new Error(`sendDirectMessage failed: ${res.status}`);
  return res.json();
}

export async function fetchDirectLog(): Promise<DirectMessage[]> {
  const res = await fetchWithRetry(agentsUrl("/direct/log"));
  if (!res.ok) throw new Error(`fetchDirectLog failed: ${res.status}`);
  const data = await res.json();
  return data.messages ?? [];
}
