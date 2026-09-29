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

// ── FastAPI calls ──────────────────────────────────────────────────────────

export async function fetchAgents(): Promise<AiAgent[]> {
  const res = await fetch(agentsUrl("/agents"), { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchAgents failed: ${res.status}`);
  const data = await res.json();
  const agents: AiAgent[] = data.agents ?? [];
  // Merge locally-stored runs so the UI reflects what we triggered from the browser
  const local = loadRuns();
  return agents.map(a => ({ ...a, recent_runs: [...(local[a.id] ?? []), ...(a.recent_runs ?? [])].slice(0, 5) }));
}

export async function fetchAgent(agentId: string): Promise<AiAgent | null> {
  try {
    const res = await fetch(agentsUrl(`/agents/${agentId}`), { cache: "no-store" });
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
  const res = await fetch(agentsUrl(`/agents/${agentId}/run`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, tenant_id: tenantId, correlation_id: correlationId }),
  });
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
  const res = await fetch(agentsUrl("/db/connectors"), { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchDbConnectors failed: ${res.status}`);
  const data = await res.json();
  return data.connectors ?? [];
}

export async function testDbConnector(
  connector: string,
  connectionString: string,
): Promise<DbTestResult> {
  const res = await fetch(agentsUrl("/db/connectors/test"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connector, connection_string: connectionString }),
  });
  if (!res.ok) throw new Error(`testDbConnector failed: ${res.status}`);
  return res.json();
}

export async function switchDbConnector(
  connector: string,
  connectionString: string,
): Promise<{ active_connector: string; switched_at: string; migrated_tables: number; status: string }> {
  const res = await fetch(agentsUrl(`/db/connectors/${connector}/switch`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection_string: connectionString }),
  });
  if (!res.ok) throw new Error(`switchDbConnector failed: ${res.status}`);
  return res.json();
}

export async function fetchFhir(jobId: string): Promise<Record<string, unknown>> {
  const res = await fetch(agentsUrl(`/fhir/${jobId}`), { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchFhir failed: ${res.status}`);
  return res.json();
}

export async function fetchHl7(jobId: string): Promise<string> {
  const res = await fetch(agentsUrl(`/hl7/${jobId}`), { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchHl7 failed: ${res.status}`);
  const data = await res.json();
  return data.message ?? data.hl7 ?? JSON.stringify(data, null, 2);
}
