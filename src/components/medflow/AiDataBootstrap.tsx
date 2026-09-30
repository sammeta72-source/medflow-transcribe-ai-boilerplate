import { headers } from "next/headers";

// Server Component — fetches FastAPI data server-side (where localhost:8000 IS
// reachable) and embeds it in the page HTML as window.__MEDFLOW_AI_DATA__.
// The client sections read from this as initial state, so even if runtime
// fetches fail in published/new-tab mode, the sections show data (not "Failed
// to load").
//
// This is the ROBUST fix for the persistent 502: the data is IN THE HTML when
// the page loads — no runtime fetch needed for initial render.

const FASTAPI_BASE = "http://localhost:8000/api";

async function fetchJson(url: string, fallback: unknown, timeoutMs = 4000): Promise<unknown> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export async function AiDataBootstrap() {
  // Fetch all read-only FastAPI data server-side (parallel)
  const [agents, dbConnectors, fhirSubscriptions, directLog, copilotSummary] = await Promise.all([
    fetchJson(`${FASTAPI_BASE}/agents`, { agents: null }),
    fetchJson(`${FASTAPI_BASE}/db/connectors`, { connectors: null }),
    fetchJson(`${FASTAPI_BASE}/fhir/subscription`, { subscriptions: null }),
    fetchJson(`${FASTAPI_BASE}/direct/log`, { messages: null }),
    fetchJson(`${FASTAPI_BASE}/copilot/summarize`, null, 6000),
  ]);

  // Extract arrays — use null (NOT empty []) when the fetch failed, so the
  // client-side `??` operator falls through to the STATIC fallback data.
  const agentsArr = (agents as { agents?: unknown[] })?.agents;
  const connArr = (dbConnectors as { connectors?: unknown[] })?.connectors;
  const subArr = (fhirSubscriptions as { subscriptions?: unknown[] })?.subscriptions;
  const logArr = (directLog as { messages?: unknown[] })?.messages;

  const embedded = {
    // Only embed if the array has items — otherwise leave undefined so the
    // client falls back to STATIC_* data hardcoded in the JS bundle.
    agents: Array.isArray(agentsArr) && agentsArr.length > 0 ? agentsArr : undefined,
    dbConnectors: Array.isArray(connArr) && connArr.length > 0 ? connArr : undefined,
    fhirSubscriptions: Array.isArray(subArr) && subArr.length > 0 ? subArr : undefined,
    directLog: Array.isArray(logArr) && logArr.length > 0 ? logArr : undefined,
    copilotSummary: copilotSummary && typeof copilotSummary === "object" && "daily_backlog_risk" in (copilotSummary as Record<string, unknown>) ? copilotSummary : undefined,
    embeddedAt: new Date().toISOString(),
  };

  // Inject as a global variable the client can read
  const json = JSON.stringify(embedded).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__MEDFLOW_AI_DATA__=${json};`,
      }}
    />
  );
}
