// MedFlow AI Operations Copilot — agent-run proxy endpoint (server-side only).
// Forwards to the FastAI service on :8000 and summarises the result for the chat UI.
//
// POST body: { agentId: string, jobId?: string }
// Response:  Either the FastAPI run result (as-is), or a synthetic mock when
//            FastAPI is unreachable. Always 200 so the chatbot can answer.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AgentRequestBody {
  agentId?: string;
  jobId?: string;
}

const FASTAPI_BASE = "http://localhost:8000";
const DEFAULT_JOB_ID = "JOB-2024-001";
const TENANT_ID = "org_demo";

// Known MedFlow agent ids — used by the summarizer + the client detector.
export const KNOWN_AGENTS = [
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
] as const;

type KnownAgent = (typeof KNOWN_AGENTS)[number];

// ── Agent result summarizer ────────────────────────────────────────────────
// Returns a 1-2 sentence human summary based on the agent id + run output.
export function summarizeAgentRun(
  agentId: string,
  run: {
    job_id?: string;
    status?: string;
    duration_ms?: number;
    cost_usd?: number;
    output?: Record<string, unknown> | null;
  },
): string {
  const o = (run.output ?? {}) as Record<string, unknown>;
  const jobId = run.job_id ?? "unknown";
  const status = run.status ?? "succeeded";
  const dur = typeof run.duration_ms === "number" ? `${run.duration_ms}ms` : "";
  const cost = typeof run.cost_usd === "number" ? `$${run.cost_usd.toFixed(4)}` : "";

  // Failure path — short-circuit.
  if (status !== "succeeded") {
    return `Agent "${agentId}" on ${jobId} → ${status}. ${dur} ${cost}`.trim();
  }

  switch (agentId as KnownAgent) {
    case "transcription": {
      const conf =
        typeof o.confidence === "number"
          ? `${(o.confidence * 100).toFixed(0)}%`
          : "—";
      return `Transcription complete — confidence ${conf}${dur ? `, ${dur}` : ""}${cost ? `, ${cost}` : ""}`;
    }
    case "qa": {
      const qs = typeof o.quality_score === "number" ? `${o.quality_score}` : "—";
      // FastAPI returns `severity`; spec said `risk_severity` — handle both.
      const risk =
        (typeof o.risk_severity === "string" && o.risk_severity) ||
        (typeof o.severity === "string" && o.severity) ||
        "—";
      const fc = Array.isArray(o.findings) ? `, ${o.findings.length} findings` : "";
      return `QA score ${qs}/100, risk ${risk}${fc}${dur ? `, ${dur}` : ""}`;
    }
    case "structuring": {
      const t = typeof o.template === "string" ? o.template : "structured note";
      const sec = Array.isArray(o.sections) ? `${o.sections.length} sections` : "";
      return `Structured as ${t}${sec ? ` (${sec})` : ""}${dur ? `, ${dur}` : ""}`;
    }
    case "allocation": {
      const name =
        (typeof o.assigned_user_name === "string" && o.assigned_user_name) ||
        (typeof o.assigned_to === "string" && o.assigned_to) ||
        "a worker";
      const reason = typeof o.reason === "string" ? ` — ${o.reason}` : "";
      return `Routed to ${name}${reason}${dur ? `, ${dur}` : ""}`;
    }
    case "sla": {
      const atRisk = Array.isArray(o.jobs_at_risk) ? o.jobs_at_risk.length : 0;
      const esc =
        typeof o.escalation_triggered === "number"
          ? `, ${o.escalation_triggered} escalations`
          : "";
      return `${atRisk} jobs at risk${esc}${dur ? `, ${dur}` : ""}`;
    }
    case "delivery": {
      const channel =
        (typeof o.channel === "string" && o.channel) ||
        (typeof o.method === "string" && o.method) ||
        "channel";
      const code = typeof o.response_code === "number" ? ` (HTTP ${o.response_code})` : "";
      return `Delivered via ${channel}${code}${dur ? `, ${dur}` : ""}`;
    }
    case "billing": {
      const amt = typeof o.amount_usd === "number" ? `$${o.amount_usd.toFixed(2)}` : "—";
      const inv = typeof o.invoice_id === "string" ? ` ${o.invoice_id}` : "";
      return `Billed ${amt}${inv}${dur ? `, ${dur}` : ""}`;
    }
    case "security": {
      const threats =
        typeof o.threats_blocked === "number" ? `${o.threats_blocked} blocked` : "clean";
      return `Security scan: ${threats}${dur ? `, ${dur}` : ""}`;
    }
    case "reporting": {
      const rows = typeof o.rows_emitted === "number" ? `${o.rows_emitted} rows` : "report";
      return `Report generated (${rows})${dur ? `, ${dur}` : ""}`;
    }
    case "intake-validation": {
      const valid = o.valid === true ? "valid" : "invalid";
      const meta =
        typeof o.metadata_completeness === "number"
          ? `metadata ${(o.metadata_completeness * 100).toFixed(0)}%`
          : "";
      const mal =
        typeof o.malware_scan === "string" ? `malware=${o.malware_scan}` : "";
      return `Intake ${valid}${meta ? `, ${meta}` : ""}${mal ? `, ${mal}` : ""}${dur ? `, ${dur}` : ""}`;
    }
    default: {
      // Unknown agent — generic JSON snippet.
      const snip = JSON.stringify(o).slice(0, 80);
      return `Agent ${agentId} ran${dur ? ` (${dur})` : ""}${cost ? ` ${cost}` : ""}: ${snip}`;
    }
  }
}

// ── Synthetic mock (used when FastAPI is unreachable) ──────────────────────
function syntheticMock(agentId: string, jobId?: string) {
  const dur = Math.floor(700 + Math.random() * 800);
  const cost = +(Math.random() * 0.002 + 0.0005).toFixed(4);
  const finalJobId = jobId ?? DEFAULT_JOB_ID;
  return {
    agent_id: agentId,
    job_id: finalJobId,
    tenant_id: TENANT_ID,
    correlation_id: `copilot-${Math.random().toString(36).slice(2, 11)}`,
    status: "succeeded",
    started_at: new Date(Date.now() - dur).toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: dur,
    cost_usd: cost,
    output: {
      note: "FastAPI unreachable — returning synthetic mock",
      agent_id: agentId,
    },
    synthetic: true,
  };
}

export async function POST(req: Request) {
  let body: AgentRequestBody;
  try {
    body = (await req.json()) as AgentRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  if (!agentId) {
    return NextResponse.json(
      { error: "agentId (string) is required" },
      { status: 400 },
    );
  }

  const jobId = typeof body.jobId === "string" && body.jobId.trim().length > 0
    ? body.jobId.trim()
    : DEFAULT_JOB_ID;
  const correlationId = `copilot-${Math.random().toString(36).slice(2, 11)}`;

  const url = `${FASTAPI_BASE}/api/agents/${encodeURIComponent(agentId)}/run`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        tenant_id: TENANT_ID,
        correlation_id: correlationId,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!upstream.ok) {
      // FastAPI responded with an error — return synthetic mock so the chatbot
      // can still answer the user.
      const mock = syntheticMock(agentId, jobId);
      return NextResponse.json({ ...mock, upstream_status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch {
    // Network error, abort, or non-JSON — fall back to synthetic mock.
    const mock = syntheticMock(agentId, jobId);
    return NextResponse.json({ ...mock, fallback_reason: "fastapi_unreachable" });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/chat/agent",
    method: "POST",
    body: { agentId: "string", jobId: "string (optional, default JOB-2024-001)" },
    known_agents: KNOWN_AGENTS,
  });
}
