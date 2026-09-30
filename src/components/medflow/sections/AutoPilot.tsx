"use client";
// MedFlow — Auto-Pilot (A9 + A11)
// Autonomous pipeline control center. Master switch enables end-to-end
// AI-driven workflow; humans only review the ~15% exception queue.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertOctagon, Bot, CheckCircle2, ChevronRight, CircleDot,
  Cog, FileSearch, Loader2, RefreshCw, Rocket, ShieldCheck, Sparkles,
  TriangleAlert, Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatRelative } from "@/lib/medflow/format";
import { RISK_SEVERITY_STYLES, PRIORITY_STYLES } from "@/lib/medflow/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader, SectionError, SectionLoading, StatCard, EmptyState } from "./_shared";

// ── Types ──────────────────────────────────────────────────────────────────
interface PipelineStats {
  total_in_pipeline: number;
  auto_approved: number;
  auto_routed: number;
  human_review: number;
  auto_rate: number;
}
interface PipelineStage {
  id: string;
  name: string;
  autonomous: boolean;
  jobs_processed: number;
  success_rate: number;
}
interface ExceptionItem {
  id: string;
  job_number: string;
  priority: string;
  ai_confidence: number | null;
  quality_score: number | null;
  risk_severity: string;
  reason: string;
}
interface AutopilotResponse {
  enabled: boolean;
  activated_at: string | null;
  pipeline_stats: PipelineStats;
  stages: PipelineStage[];
  exceptions: ExceptionItem[];
}

// ── Component ──────────────────────────────────────────────────────────────
export function AutoPilot() {
  const { data, loading, error, refresh } = useFetch<AutopilotResponse>("/api/medflow/autopilot");
  const [enabled, setEnabled] = useState(false);
  const [activatedAt, setActivatedAt] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  // Sync local toggle state with fetched server state
  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setActivatedAt(data.activated_at);
    }
  }, [data]);

  async function handleToggle(next: boolean) {
    setToggling(true);
    const prev = enabled;
    setEnabled(next);
    try {
      const res = await fetch("/api/medflow/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error(`autopilot POST failed: ${res.status}`);
      const json: { ok: boolean; enabled: boolean; activated_at: string | null } = await res.json();
      setEnabled(json.enabled);
      setActivatedAt(json.activated_at);
      toast.success(
        next ? "Auto-Pilot activated — pipeline is fully autonomous"
             : "Auto-Pilot deactivated — pipeline is human-assisted",
      );
      refresh();
    } catch (e) {
      setEnabled(prev);
      toast.error(`Toggle failed: ${(e as Error).message}`);
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Auto-Pilot"
          description="Autonomous pipeline mode — the entire workflow runs without human intervention. Humans only review the ~15% exception queue."
          icon={Rocket}
        />
        <SectionLoading rows={4} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <PageHeader
          title="Auto-Pilot"
          description="Autonomous pipeline mode — the entire workflow runs without human intervention. Humans only review the ~15% exception queue."
          icon={Rocket}
        />
        <SectionError message={error ?? "Unknown"} onRetry={refresh} />
      </div>
    );
  }

  const ps = data.pipeline_stats;
  const stages = data.stages;
  const exceptions = data.exceptions;

  return (
    <div>
      <PageHeader
        title="Auto-Pilot"
        description="Autonomous pipeline mode — the entire workflow runs without human intervention. Humans only review the ~15% exception queue."
        icon={Rocket}
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={toggling}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Master Switch Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card
          className={cn(
            "relative overflow-hidden transition-all",
            enabled
              ? "border-emerald-400 ring-2 ring-emerald-400/40 shadow-[0_0_28px_-6px_rgba(16,185,129,0.45)]"
              : "border-border",
          )}
        >
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-xl transition-colors",
                    enabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Rocket className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Master Switch
                  </p>
                  <p className="text-lg font-bold leading-tight text-foreground">
                    {enabled
                      ? "Auto-Pilot ON — Pipeline is fully autonomous"
                      : "Auto-Pilot OFF — Pipeline is human-assisted"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {enabled
                      ? activatedAt
                        ? `Activated ${formatRelative(activatedAt)} · AI runs intake → transcription → structuring → QA → allocation → delivery`
                        : "Active · AI handles the full pipeline end-to-end"
                      : "Toggle on to let AI run the entire pipeline. Humans review only the exception queue."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    enabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <CircleDot className={cn("h-3 w-3", enabled && "mf-pulse text-emerald-600")} />
                  {enabled ? "AUTONOMOUS" : "HUMAN-ASSISTED"}
                </span>
                <Switch
                  checked={enabled}
                  onCheckedChange={handleToggle}
                  disabled={toggling}
                  aria-label="Toggle Auto-Pilot"
                  className="data-[state=checked]:bg-emerald-500"
                />
                {toggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          </CardContent>
          {enabled && (
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-emerald-50 via-transparent to-transparent opacity-70" />
          )}
        </Card>
      </motion.div>

      {/* KPI StatCards */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Cog}
          label="In Pipeline"
          value={ps.total_in_pipeline}
          accent="text-secondary"
          sub="active jobs"
        />
        <StatCard
          icon={CheckCircle2}
          label="Auto-Approved"
          value={ps.auto_approved}
          deltaTone="up"
          accent="text-emerald-600"
          sub="AI-validated, no human touch"
        />
        <StatCard
          icon={Bot}
          label="Auto-Routed"
          value={ps.auto_routed}
          accent="text-amber-600"
          sub="AI routed to right editor"
        />
        <StatCard
          icon={Users}
          label="Human Review"
          value={ps.human_review}
          deltaTone="down"
          accent="text-red-600"
          sub="exception queue"
        />
      </div>

      {/* Auto-Approval Callout */}
      <Alert className="mt-4 border-emerald-300 bg-emerald-50 [&>svg]:text-emerald-600">
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Auto-Approval Rate</AlertTitle>
        <AlertDescription className="text-[12px]">
          AI auto-approves <span className="font-bold text-emerald-700">{ps.auto_rate}%</span> of jobs.
          Only <span className="font-bold text-foreground">{ps.human_review}</span> jobs require human review.
        </AlertDescription>
      </Alert>

      {/* Autonomous Pipeline Flow */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cog className="h-4 w-4 text-secondary" /> Autonomous Pipeline Flow
              </CardTitle>
              <CardDescription className="text-xs">
                6 stages — AI runs each one. Humans only see items flagged into the exception queue.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                enabled
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {enabled ? "● Autonomous" : "○ Human-assisted"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "flex flex-wrap items-stretch gap-2 rounded-xl border p-3 transition-colors",
              enabled
                ? "border-emerald-200 bg-emerald-50/40"
                : "border-border bg-muted/20 opacity-60",
            )}
          >
            {stages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-2">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, delay: idx * 0.06 }}
                  className={cn(
                    "flex min-w-[140px] flex-col items-center rounded-xl border p-3 text-center transition-colors",
                    enabled
                      ? "border-emerald-300 bg-card"
                      : "border-border bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold",
                      enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                      enabled && idx % 2 === 0 && "mf-pulse",
                    )}
                  >
                    {idx + 1}
                  </span>
                  <p className="mt-2 text-[12px] font-semibold leading-tight text-foreground">
                    {stage.name}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    {stage.autonomous ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Autonomous ✓
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                        <Users className="h-2.5 w-2.5" /> Manual
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                    <div>
                      <p className="font-mono font-bold text-foreground">{stage.jobs_processed}</p>
                      <p>jobs</p>
                    </div>
                    <div>
                      <p className="font-mono font-bold text-foreground">
                        {Math.round(stage.success_rate * 100)}%
                      </p>
                      <p>success</p>
                    </div>
                  </div>
                </motion.div>
                {idx < stages.length - 1 && (
                  <ChevronRight
                    className={cn(
                      "hidden h-5 w-5 shrink-0 sm:block",
                      enabled ? "text-emerald-500" : "text-muted-foreground",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          {!enabled && (
            <p className="mt-3 text-center text-[11px] italic text-muted-foreground">
              Pipeline is muted — turn Auto-Pilot ON to engage autonomous execution.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Exception Queue */}
      <Card className="mt-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertOctagon className="h-4 w-4 text-red-600" /> Exception Queue
            </CardTitle>
            <CardDescription className="text-xs">
              The ONLY queue humans need to review — AI-flagged risks requiring human judgment.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-[10px]">
            {exceptions.length} items
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {exceptions.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              message="No exceptions — all jobs auto-approved. The pipeline is fully autonomous."
            />
          ) : (
            <div className="mf-scroll max-h-[520px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-[11px]">Job #</TableHead>
                    <TableHead className="text-[11px]">Priority</TableHead>
                    <TableHead className="text-[11px]">AI Confidence</TableHead>
                    <TableHead className="text-[11px]">Quality Score</TableHead>
                    <TableHead className="text-[11px]">Risk</TableHead>
                    <TableHead className="text-[11px]">Reason</TableHead>
                    <TableHead className="text-[11px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptions.map((ex, i) => {
                    const priorityStyle =
                      PRIORITY_STYLES[ex.priority as keyof typeof PRIORITY_STYLES] ??
                      { badge: "bg-muted text-foreground border-border" };
                    const riskStyle =
                      RISK_SEVERITY_STYLES[ex.risk_severity as keyof typeof RISK_SEVERITY_STYLES] ??
                      { badge: "bg-muted text-foreground border-border", dot: "bg-slate-400", label: ex.risk_severity };
                    return (
                      <motion.tr
                        key={ex.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: i * 0.03 }}
                        className="hover:bg-muted/40"
                      >
                        <TableCell className="font-mono text-[12px] font-semibold text-foreground">
                          {ex.job_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]", priorityStyle.badge)}>
                            {ex.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(ex.ai_confidence ?? 0) * 100}
                              className="h-1.5 w-16"
                            />
                            <span className="font-mono text-[11px] text-foreground">
                              {ex.ai_confidence != null ? `${Math.round(ex.ai_confidence * 100)}%` : "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[12px] text-foreground">
                          {ex.quality_score != null ? ex.quality_score : "—"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              riskStyle.badge,
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", riskStyle.dot)} />
                            {riskStyle.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <TriangleAlert className="h-3 w-3 text-amber-600" />
                            {ex.reason}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() =>
                              toast.info(`Opening ${ex.job_number} in editor workspace`, {
                                description: ex.reason,
                              })
                            }
                          >
                            <FileSearch className="mr-1 h-3 w-3" /> Open
                          </Button>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance callout */}
      <Alert className="mt-4 border-secondary/30 bg-secondary/5 [&>svg]:text-secondary">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Why autonomous works for medical transcription</AlertTitle>
        <AlertDescription className="text-[12px]">
          Each stage produces auditable evidence + every AI decision is explainable (EU AI Act Art. 13 + FDA SaMD).
          The exception queue is the human-in-the-loop checkpoint — anything ambiguous, low-confidence, or high-risk is escalated.
        </AlertDescription>
      </Alert>
    </div>
  );
}
