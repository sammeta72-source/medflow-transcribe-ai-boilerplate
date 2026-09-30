"use client";
// MedFlow — AI Agent Orchestration panel.
// Uses fetchAgents() / runAgent() from src/lib/medflow/api.ts which talk to
// the FastAPI service on :8000 through the Caddy gateway (?XTransformPort=8000).

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Bot, ChevronDown, ChevronRight, Cpu, DollarSign,
  Play, RefreshCw, ShieldCheck, Sparkles, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fetchAgents, runAgent, getEmbeddedAiData } from "@/lib/medflow/api";
import { STATIC_AGENTS } from "@/lib/medflow/static-data";
import type { AgentRun, AiAgent } from "@/lib/medflow/types";
import { formatRelative, usd } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

const STATUS_BADGE: Record<string, { badge: string; dot: string }> = {
  idle: { badge: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-400" },
  running: { badge: "bg-blue-100 text-blue-700 border-blue-300", dot: "bg-blue-500" },
  succeeded: { badge: "bg-emerald-100 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" },
  failed: { badge: "bg-red-100 text-red-700 border-red-300", dot: "bg-red-500" },
};

const CATEGORY_STRIPE: Record<string, string> = {
  governance: "mf-tab-yellow",
  ai: "mf-tab-orange",
  orchestration: "mf-tab-green",
  monitoring: "mf-tab-brown",
  delivery: "mf-tab-blue",
  billing: "mf-tab-teal",
  security: "mf-tab-pink",
  reporting: "mf-tab-purple",
};

function summarizeRun(agentId: string, run: AgentRun): string {
  const o = run.output ?? {};
  switch (agentId) {
    case "transcription": {
      const conf = typeof o.confidence === "number" ? `${(o.confidence * 100).toFixed(0)}% conf` : "";
      const txt = typeof o.transcript === "string" ? o.transcript.slice(0, 80) : JSON.stringify(o).slice(0, 80);
      return `${conf} · ${txt}…`;
    }
    case "qa": {
      const qs = typeof o.quality_score === "number" ? `Q=${o.quality_score}` : "";
      const rs = typeof o.risk_severity === "string" ? `risk=${o.risk_severity}` : "";
      const fc = Array.isArray(o.findings) ? `${o.findings.length} findings` : "";
      return [qs, rs, fc].filter(Boolean).join(" · ");
    }
    case "allocation": {
      const an = typeof o.assigned_user_name === "string" ? `→ ${o.assigned_user_name}` : "";
      return an || JSON.stringify(o).slice(0, 100);
    }
    case "delivery": {
      return typeof o.method === "string" ? `via ${o.method}` : "delivered";
    }
    default:
      return JSON.stringify(o).slice(0, 100);
  }
}

export function AIAgents() {
  // Initialize from server-embedded data (from AiDataBootstrap) — shows data
  // immediately, no loading delay, even if runtime fetches fail.
  const embAgents = getEmbeddedAiData().agents;
  const embeddedAgents = (embAgents && embAgents.length > 0) ? embAgents : STATIC_AGENTS;
  const [agents, setAgents] = useState<AiAgent[] | null>(embeddedAgents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [allRuns, setAllRuns] = useState<AgentRun[]>(
    embeddedAgents ? embeddedAgents.flatMap(a => a.recent_runs ?? []).slice(0, 20) : [],
  );

  async function load() {
    // Don't show loading skeleton if we already have data (static/embedded)
    if (!agents) setLoading(true);
    setError(null);
    try {
      const list = await fetchAgents();
      setAgents(list);
      const runs: AgentRun[] = list.flatMap(a => a.recent_runs ?? []).slice(0, 20);
      setAllRuns(runs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRun(agent: AiAgent) {
    setRunning(agent.id);
    try {
      const run = await runAgent(agent.id, "JOB-2024-001");
      const summary = summarizeRun(agent.id, run);
      toast.success(`${agent.name} succeeded`, {
        description: summary || `${run.duration_ms}ms · cost ${usd(run.cost_usd)}`,
      });
      setAllRuns(prev => [run, ...prev].slice(0, 20));
      setAgents(prev => prev?.map(a => a.id === agent.id
        ? {
            ...a,
            status: "succeeded",
            last_run_at: run.completed_at ?? run.started_at,
            last_duration_ms: run.duration_ms,
            last_cost_usd: run.cost_usd,
            success_count: a.success_count + 1,
            recent_runs: [run, ...(a.recent_runs ?? [])].slice(0, 5),
          }
        : a) ?? null);
    } catch (e) {
      const run: AgentRun = {
        run_id: `r-err-${Date.now()}`,
        agent_id: agent.id,
        job_id: "JOB-2024-001",
        correlation_id: "-",
        status: "failed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 0,
        cost_usd: 0,
      };
      setAllRuns(prev => [run, ...prev].slice(0, 20));
      setAgents(prev => prev?.map(a => a.id === agent.id
        ? { ...a, status: "failed", failure_count: a.failure_count + 1, recent_runs: [run, ...(a.recent_runs ?? [])].slice(0, 5) }
        : a) ?? null);
      toast.error(`${agent.name} failed`, { description: (e as Error).message });
    } finally {
      setRunning(null);
    }
  }

  async function runAllIdle() {
    if (!agents) return;
    const idle = agents.filter(a => a.status !== "running");
    for (const a of idle) {
      // eslint-disable-next-line no-await-in-loop
      await handleRun(a);
    }
    toast.success("All idle agents ran", { description: `${idle.length} agents dispatched` });
  }

  if (loading) return (
    <div>
      <PageHeader title="AI Agent Orchestration" description="10 background agents running on FastAPI :8000." icon={Bot} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !agents) return (
    <div>
      <PageHeader title="AI Agent Orchestration" description="10 background agents running on FastAPI :8000." icon={Bot} />
      <SectionError message={error ?? "Unknown"} onRetry={load} />
    </div>
  );

  const idleCount = agents.filter(a => a.status === "idle").length;
  const runningCount = agents.filter(a => a.status === "running" || a.id === running).length;
  const succeededCount = agents.filter(a => a.status === "succeeded").length;
  const failedCount = agents.filter(a => a.status === "failed").length;

  return (
    <div>
      <PageHeader
        title="AI Agent Orchestration"
        description="10 background agents running on FastAPI :8000. Tenant-aware, idempotent, retryable."
        icon={Bot}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={runAllIdle} disabled={running !== null}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Run all idle ({idleCount})
            </Button>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      />

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-3 text-[11px]">
        <span className="font-semibold text-foreground">Status:</span>
        {(["idle", "running", "succeeded", "failed"] as const).map(s => {
          const cnt = s === "idle" ? idleCount : s === "running" ? runningCount : s === "succeeded" ? succeededCount : failedCount;
          return (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_BADGE[s].dot} ${s === "running" ? "mf-pulse" : ""}`} />
              <span className="capitalize text-muted-foreground">{s}</span>
              <span className="font-bold">{cnt}</span>
            </span>
          );
        })}
      </div>

      {/* Agent grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((a, i) => {
          const sb = STATUS_BADGE[a.status] ?? STATUS_BADGE.idle;
          const isRunning = running === a.id || a.status === "running";
          const stripe = CATEGORY_STRIPE[a.category] ?? "mf-tab-slate";
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <Card className="relative h-full overflow-hidden">
                <div className={cn("absolute left-0 top-0 h-1 w-full", stripe)} />
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <CardDescription className="text-[11px]">{a.id}</CardDescription>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", sb.badge)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sb.dot, isRunning && "mf-pulse")} />
                      {a.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="mb-3 text-[11px] text-muted-foreground line-clamp-2">{a.description}</p>

                  <div className="mb-3 grid grid-cols-2 gap-1 text-[10px]">
                    <div className="rounded bg-muted/40 px-1.5 py-1">
                      <span className="text-muted-foreground">Model</span>
                      <p className="font-semibold text-foreground">{a.model}</p>
                    </div>
                    <div className="rounded bg-muted/40 px-1.5 py-1">
                      <span className="text-muted-foreground">Prompt</span>
                      <p className="font-semibold text-foreground">{a.prompt_version}</p>
                    </div>
                    <div className="rounded bg-muted/40 px-1.5 py-1">
                      <span className="text-muted-foreground">Success</span>
                      <p className="font-semibold text-emerald-600">{a.success_count}</p>
                    </div>
                    <div className="rounded bg-muted/40 px-1.5 py-1">
                      <span className="text-muted-foreground">Failed</span>
                      <p className="font-semibold text-red-600">{a.failure_count}</p>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" /> last {formatRelative(a.last_run_at)}
                    </span>
                    {a.last_duration_ms != null && (
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" /> {a.last_duration_ms}ms
                      </span>
                    )}
                    {a.last_cost_usd != null && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> {usd(a.last_cost_usd)}
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    className="w-full bg-primary text-primary-foreground"
                    onClick={() => handleRun(a)}
                    disabled={isRunning}
                  >
                    {isRunning ? <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" /> : <Play className="mr-1.5 h-3 w-3" />}
                    Run on JOB-2024-001
                  </Button>

                  {/* Last run output collapsible */}
                  {a.recent_runs && a.recent_runs.length > 0 && (
                    <Collapsible
                      open={expanded === a.id}
                      onOpenChange={(o) => setExpanded(o ? a.id : null)}
                      className="mt-2"
                    >
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted/60">
                        <span>Last run output</span>
                        {expanded === a.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="mt-1 max-h-44 mf-scroll overflow-y-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed text-foreground">
{JSON.stringify(a.recent_runs[0]?.output ?? {}, null, 2)}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Recent runs table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent runs</CardTitle>
            <CardDescription className="text-xs">Latest 20 agent invocations across all agents</CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <Zap className="mr-1 h-3 w-3 text-secondary" /> {allRuns.length} runs
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {allRuns.length === 0 ? (
            <EmptyState icon={Bot} message="No runs yet — click Run on an agent above." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Agent</TableHead>
                  <TableHead className="text-[11px]">Job</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                  <TableHead className="text-[11px]">Duration</TableHead>
                  <TableHead className="text-[11px]">Cost</TableHead>
                  <TableHead className="text-[11px]">When</TableHead>
                  <TableHead className="text-[11px]">Correlation ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRuns.map((r, i) => {
                  const sb = STATUS_BADGE[r.status] ?? STATUS_BADGE.idle;
                  return (
                    <motion.tr
                      key={`${r.run_id}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="hover:bg-muted/40"
                    >
                      <TableCell className="font-mono text-[11px] font-semibold">{r.agent_id}</TableCell>
                      <TableCell className="font-mono text-[11px]">{r.job_id}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", sb.badge)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", sb.dot)} /> {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px]">{r.duration_ms}ms</TableCell>
                      <TableCell className="text-[11px]">{usd(r.cost_usd)}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{formatRelative(r.completed_at ?? r.started_at)}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{r.correlation_id}</TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Compliance note */}
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-secondary/30 bg-secondary/5 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-secondary" />
        <div>
          <p className="text-sm font-semibold text-foreground">All agents are tenant-aware, idempotent, and retryable.</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Every run is logged with a correlation ID, supports human escalation routes, and respects per-tenant quotas. AI never marks a document clinically final — the originating Provider must capture the electronic signature.
          </p>
        </div>
      </div>
    </div>
  );
}
