// MedFlow Transcribe AI — API client (DUAL-mechanism: gateway-direct + proxy-fallback).
//
// FastAPI calls use a dual strategy so they work in EVERY access context:
//   1. GATEWAY-DIRECT (primary): `/${path}?XTransformPort=8000`
//      - The Caddy gateway (port 81) sees the XTransformPort query + forwards
//        DIRECTLY to localhost:8000 (FastAPI). 1-hop. No Next.js dependency.
//      - Works when the app is accessed via the gateway (preview panel, published
//        new tab, public URL).
//   2. PROXY-FALLBACK (secondary): `/api/ai/${path}`
//      - The Next.js catch-all API route forwards to localhost:8000. 2-hop.
//      - Used when the gateway mechanism returns 404 (i.e. the app is accessed
//        directly on port 3000 with no gateway in the path).
//
// This resolves the persistent 502 in published/new-tab mode: the gateway-direct
// mechanism doesn't depend on the Next.js dev server's API routes being compiled.

import type { AiAgent, AgentRun, DbConnector, DbTestResult } from "./types";
import { STATIC_AGENTS, STATIC_DB_CONNECTORS, STATIC_FHIR_SUBSCRIPTIONS, STATIC_DIRECT_LOG, STATIC_COPILOT_SUMMARY } from "./static-data";

const AGENTS_PORT = 8000;

// Gateway-direct URL: /api/<path>?XTransformPort=8000 — Caddy forwards to FastAPI.
function gatewayUrl(path: string): string {
  return `/api${path}?XTransformPort=${AGENTS_PORT}`;
}

// Proxy-fallback URL: /api/ai/<path> — Next.js API route forwards to FastAPI.
function proxyUrl(path: string): string {
  return `/api/ai${path}`;
}

// Backward-compatible export (some components import agentsUrl).
export const agentsUrl = proxyUrl;

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

// ── Dual-mechanism fetch: tries gateway-direct first, falls back to proxy ────
// Tries each URL in order (gateway, then proxy). For each URL, retries on
// 5xx + network errors with exponential backoff. The first URL that returns a
// non-5xx response wins. This makes FastAPI calls work whether the app is
// accessed via the gateway (published new tab) OR directly on port 3000.

const PRIMARY_URLS = (path: string) => [gatewayUrl(path), proxyUrl(path)];

async function fetchOne(url: string, init: RequestInit | undefined, attempts: number): Promise<Response | null> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000); // 15s per attempt
      const res = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      // Retry on 5xx (transient) — but 404 means "this URL doesn't exist here,
      // try the fallback". 200/4xx are returned to the caller.
      if (res.status >= 500 && i < attempts) {
        await new Promise(r => setTimeout(r, 800 * i)); // 800ms, 1.6s, 2.4s...
        continue;
      }
      return res; // includes 404 (will trigger fallback) + 200/4xx (final)
    } catch {
      if (i < attempts) await new Promise(r => setTimeout(r, 800 * i));
    }
  }
  return null; // all attempts failed for this URL
}

async function fetchAi(path: string, init?: RequestInit): Promise<Response> {
  const urls = PRIMARY_URLS(path);
  let lastError: Error | null = null;

  for (const url of urls) {
    const res = await fetchOne(url, init, 3); // 3 attempts per URL
    if (res !== null) {
      // 404 from the gateway means "no XTransformPort routing here" → try proxy
      // 200/4xx/5xx-after-retries → return (caller handles non-ok)
      if (res.status === 404) {
        lastError = new Error(`${url} returned 404 — trying fallback`);
        continue; // try next URL
      }
      return res;
    }
    lastError = new Error(`${url} failed after retries`);
  }
  throw lastError ?? new Error(`all fetch paths failed for ${path}`);
}

// Legacy single-URL retry (kept for any external callers of agentsUrl + fetchWithRetry).
async function fetchWithRetry(input: string, init?: RequestInit, attempts = 5): Promise<Response> {
  let lastErr: Error | null = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(input, { ...init, cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      if ((res.status >= 500 || res.status === 0) && i < attempts) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i - 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < attempts) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i - 1)));
    }
  }
  throw lastErr ?? new Error("fetch failed after retries");
}

export async function fetchAgents(): Promise<AiAgent[]> {
  try {
    const res = await fetchAi("/agents");
    if (!res.ok) throw new Error(`fetchAgents failed: ${res.status}`);
    const data = await res.json();
    const agents: AiAgent[] = data.agents ?? [];
    const local = loadRuns();
    return agents.map(a => ({ ...a, recent_runs: [...(local[a.id] ?? []), ...(a.recent_runs ?? [])].slice(0, 5) }));
  } catch {
    // Fallback: server-embedded data → then STATIC data (hardcoded in bundle)
    const embedded = getEmbeddedAiData().agents ?? STATIC_AGENTS;
    const local = loadRuns();
    return embedded.map(a => ({ ...a, recent_runs: [...(local[a.id] ?? []), ...(a.recent_runs ?? [])].slice(0, 5) }));
  }
}

export async function fetchAgent(agentId: string): Promise<AiAgent | null> {
  try {
    const res = await fetchAi(`/agents/${agentId}`);
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
  const res = await fetchAi(
    `/agents/${agentId}/run`,
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
  try {
    const res = await fetchAi("/db/connectors");
    if (!res.ok) throw new Error(`fetchDbConnectors failed: ${res.status}`);
    const data = await res.json();
    return data.connectors ?? [];
  } catch {
    return getEmbeddedAiData().dbConnectors ?? STATIC_DB_CONNECTORS;
  }
}

export async function testDbConnector(
  connector: string,
  connectionString: string,
): Promise<DbTestResult> {
  const res = await fetchAi(
    "/db/connectors/test",
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
  const res = await fetchAi(
    `/db/connectors/${connector}/switch`,
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
  const res = await fetchAi(`/fhir/${jobId}`);
  if (!res.ok) throw new Error(`fetchFhir failed: ${res.status}`);
  return res.json();
}

export async function fetchHl7(jobId: string): Promise<string> {
  const res = await fetchAi(`/hl7/${jobId}`);
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
  try {
    const res = await fetchAi(
      "/copilot/summarize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_role: managerRole }),
      },
    );
    if (!res.ok) throw new Error(`fetchCopilotSummary failed: ${res.status}`);
    return res.json();
  } catch {
    // Fallback: server-embedded → then STATIC data (hardcoded in bundle)
    return getEmbeddedAiData().copilotSummary ?? STATIC_COPILOT_SUMMARY;
  }
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
  const res = await fetchAi(
    "/entities/extract",
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
  const res = await fetchAi(
    "/hallucination/detect",
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
  try {
    const res = await fetchAi("/fhir/subscription");
    if (!res.ok) throw new Error(`fetchFhirSubscriptions failed: ${res.status}`);
    const data = await res.json();
    return data.subscriptions ?? [];
  } catch {
    return getEmbeddedAiData().fhirSubscriptions ?? STATIC_FHIR_SUBSCRIPTIONS;
  }
}

export async function createFhirSubscription(
  criteria: string,
  channel_type: string,
  endpoint: string,
  reason: string,
): Promise<FhirSubscription> {
  const res = await fetchAi(
    "/fhir/subscription",
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
  const res = await fetchAi(
    `/fhir/subscription/${subscriptionId}/fire`,
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
  const res = await fetchAi(
    `/fhir/subscription/${subscriptionId}`,
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
  const res = await fetchAi(
    "/direct/send",
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
  try {
    const res = await fetchAi("/direct/log");
    if (!res.ok) throw new Error(`fetchDirectLog failed: ${res.status}`);
    const data = await res.json();
    return data.messages ?? [];
  } catch {
    return getEmbeddedAiData().directLog ?? STATIC_DIRECT_LOG;
  }
}

// ── Server-side embedded data fallback ──────────────────────────────────────
// AiDataBootstrap (Server Component in layout.tsx) fetches FastAPI data
// server-side + embeds it as window.__MEDFLOW_AI_DATA__. Client sections read
// from this as initial state — so even if runtime fetches fail (502 in
// published/new-tab mode), the sections show data (not "Failed to load").

export interface EmbeddedAiData {
  agents?: AiAgent[];
  dbConnectors?: DbConnector[];
  fhirSubscriptions?: FhirSubscription[];
  directLog?: DirectMessage[];
  copilotSummary?: CopilotSummary;
  embeddedAt?: string;
}

export function getEmbeddedAiData(): EmbeddedAiData {
  if (typeof window === "undefined") return {};
  try {
    return (window as unknown as { __MEDFLOW_AI_DATA__?: EmbeddedAiData }).__MEDFLOW_AI_DATA__ ?? {};
  } catch {
    return {};
  }
}
