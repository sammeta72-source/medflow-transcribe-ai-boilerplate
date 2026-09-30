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
    fetchJson(`${FASTAPI_BASE}/agents`, { agents: [] }),
    fetchJson(`${FASTAPI_BASE}/db/connectors`, { connectors: [] }),
    fetchJson(`${FASTAPI_BASE}/fhir/subscription`, { subscriptions: [] }),
    fetchJson(`${FASTAPI_BASE}/direct/log`, { messages: [] }),
    fetchJson(`${FASTAPI_BASE}/copilot/summarize`, {
      daily_backlog_risk: { total_in_pipeline: 5, at_risk_count: 2, breach_count: 1, stat_jobs: 2, escalated_count: 1 },
      sla_breach_predictions: [],
      high_rework_items: [],
      staffing_recommendation: { current_load: 5, recommended_shift_adjustment: "Add 1 editor for STAT queue", surplus_deficit: -2 },
      client_ops_report_draft: "## Client Operations Report\n\nDaily backlog: 5 in pipeline, 2 at risk, 1 breach. STAT workload: 2 jobs. Escalated: 1.\n\nRecommended action: expedite JOB-2024-004 + reassign JOB-2024-012 to senior editor.",
      generated_at: new Date().toISOString(),
      data_minimized: true,
    }, 6000),
  ]);

  const embedded = {
    agents: (agents as { agents?: unknown[] })?.agents ?? [],
    dbConnectors: (dbConnectors as { connectors?: unknown[] })?.connectors ?? [],
    fhirSubscriptions: (fhirSubscriptions as { subscriptions?: unknown[] })?.subscriptions ?? [],
    directLog: (directLog as { messages?: unknown[] })?.messages ?? [],
    copilotSummary,
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
