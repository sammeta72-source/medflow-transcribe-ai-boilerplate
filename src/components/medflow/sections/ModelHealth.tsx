"use client";
// MedFlow — AI Model Health (B7)
// Self-monitoring AI models with automatic drift detection + retraining pipeline.
// Mirrors /api/medflow/model-health response shape.

import { motion } from "framer-motion";
import {
  BrainCircuit, CheckCircle2, Cpu, Database, Gauge,
  GitBranch, Loader2, RefreshCw, Sparkles, TrendingDown, TrendingUp,
  TriangleAlert, Wrench,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";

// ── Types ──────────────────────────────────────────────────────────────────
interface RetrainingPipeline {
  stage: string;
  progress: number;
  eta: string;
  data_points: number;
  epochs: number;
  current_epoch: number;
  validation_accuracy: number;
}
interface ModelRow {
  id: string;
  name: string;
  version: string;
  accuracy: number;
  precision?: number;
  recall?: number;
  drift_detected: boolean;
  drift_score?: number;
  last_trained?: string;
  next_review?: string;
  status: string;
  retraining_pipeline?: RetrainingPipeline | null;
}
interface RetrainingHistoryRow {
  model: string;
  date: string;
  trigger: string;
  before_accuracy: number;
  after_accuracy: number;
  duration: string;
  status: string;
}
interface ModelHealthResponse {
  models: ModelRow[];
  auto_retraining_enabled: boolean;
  drift_threshold: number;
  retraining_history: RetrainingHistoryRow[];
  pipeline_stages: string[];
  next_scheduled_review: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function driftColor(score?: number): { text: string; chip: string; bar: string } {
  if (score == null) return { text: "text-muted-foreground", chip: "bg-muted text-muted-foreground border-border", bar: "bg-muted" };
  if (score < 0.05) return { text: "text-emerald-700", chip: "bg-emerald-100 text-emerald-700 border-emerald-300", bar: "bg-emerald-500" };
  if (score < 0.10) return { text: "text-amber-700", chip: "bg-amber-100 text-amber-700 border-amber-300", bar: "bg-amber-500" };
  return { text: "text-red-700", chip: "bg-red-100 text-red-700 border-red-300", bar: "bg-red-500" };
}

function statusChip(status: string): string {
  if (status === "healthy") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (status === "drift_detected") return "bg-amber-100 text-amber-800 border-amber-300";
  if (status === "retraining") return "bg-secondary/15 text-secondary border-secondary/30";
  return "bg-muted text-muted-foreground border-border";
}

function accuracyPct(a?: number): string {
  if (a == null) return "—";
  return `${(a * 100).toFixed(1)}%`;
}

const PIPELINE_LABELS: Record<string, string> = {
  data_prep: "Data Prep",
  train: "Train",
  evaluate: "Evaluate",
  deploy: "Deploy",
  monitor: "Monitor",
};

export function ModelHealth() {
  const { data, loading, error, refresh } = useFetch<ModelHealthResponse>("/api/medflow/model-health");

  if (loading) {
    return (
      <div>
        <PageHeader
          title="AI Model Health"
          description="Self-monitoring AI models with automatic drift detection + retraining pipeline. The AI improves itself."
          icon={BrainCircuit}
        />
        <SectionLoading rows={4} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <PageHeader
          title="AI Model Health"
          description="Self-monitoring AI models with automatic drift detection + retraining pipeline. The AI improves itself."
          icon={BrainCircuit}
        />
        <SectionError message={error ?? "Unknown"} onRetry={refresh} />
      </div>
    );
  }

  const healthyCount = data.models.filter(m => m.status === "healthy").length;
  const driftCount = data.models.filter(m => m.status === "drift_detected").length;
  const retrainingCount = data.models.filter(m => m.retraining_pipeline).length;

  return (
    <div>
      <PageHeader
        title="AI Model Health"
        description="Self-monitoring AI models with automatic drift detection + retraining pipeline. The AI improves itself."
        icon={BrainCircuit}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={BrainCircuit} label="Models Monitored" value={data.models.length} accent="text-secondary" sub="continuous" />
        <StatCard icon={CheckCircle2} label="Healthy" value={healthyCount} deltaTone="up" accent="text-emerald-600" sub="no drift" />
        <StatCard icon={TriangleAlert} label="Drift Detected" value={driftCount} deltaTone="down" accent="text-amber-600" sub="threshold 0.10" />
        <StatCard icon={Wrench} label="Retraining Now" value={retrainingCount} accent="text-secondary" sub="auto" />
      </div>

      {/* Auto-Retraining toggle bar */}
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={cn("grid h-10 w-10 place-items-center rounded-full", data.auto_retraining_enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Auto-Retraining {data.auto_retraining_enabled ? "Enabled" : "Disabled"}</p>
              <p className="text-[11px] text-muted-foreground">
                Drift threshold: <span className="font-mono font-semibold text-foreground">{data.drift_threshold.toFixed(2)}</span>
                {" · "}Next scheduled review: <span className="font-semibold text-foreground">{data.next_scheduled_review}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground">Auto-retrain</span>
            <Switch
              checked={data.auto_retraining_enabled}
              onCheckedChange={(v) => {
                toast(`Auto-retraining ${v ? "enabled" : "disabled"}`, {
                  description: v ? "Drift-triggered retraining will fire automatically." : "Manual retraining only.",
                });
              }}
              aria-label="Toggle auto-retraining"
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Models Table */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4 text-secondary" /> Models
          </CardTitle>
          <CardDescription className="text-xs">
            Accuracy / precision / recall + drift score (live). Drift &gt; {data.drift_threshold.toFixed(2)} triggers auto-retraining.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="mf-scroll max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-[11px]">Model</TableHead>
                  <TableHead className="text-[11px]">Version</TableHead>
                  <TableHead className="text-[11px]">Accuracy</TableHead>
                  <TableHead className="text-[11px]">Precision</TableHead>
                  <TableHead className="text-[11px]">Recall</TableHead>
                  <TableHead className="text-[11px]">Drift Score</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                  <TableHead className="text-[11px]">Last Trained</TableHead>
                  <TableHead className="text-[11px]">Next Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.models.map((m, i) => {
                  const d = driftColor(m.drift_score);
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                      className="hover:bg-muted/40"
                    >
                      <TableCell>
                        <p className="text-[12px] font-semibold text-foreground">{m.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{m.id}</p>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-foreground">{m.version ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={(m.accuracy ?? 0) * 100} className="h-1.5 w-16" />
                          <span className="font-mono text-[11px] font-semibold text-foreground">{accuracyPct(m.accuracy)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-foreground">
                        {m.precision != null ? accuracyPct(m.precision) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-foreground">
                        {m.recall != null ? accuracyPct(m.recall) : "—"}
                      </TableCell>
                      <TableCell>
                        {m.drift_score != null ? (
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-12 overflow-hidden rounded-full bg-muted")}>
                              <span className={cn("block h-full", d.bar)} style={{ width: `${Math.min(100, m.drift_score * 1000)}%` }} />
                            </span>
                            <span className={cn("font-mono text-[11px] font-semibold", d.text)}>{m.drift_score.toFixed(3)}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", statusChip(m.status))}>
                          {m.status === "healthy" && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {m.status === "drift_detected" && <TriangleAlert className="h-2.5 w-2.5" />}
                          {m.status.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{m.last_trained ?? "—"}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{m.next_review ?? "—"}</TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Retraining in Progress (cards for each model w/ active pipeline) */}
      {data.models.some(m => m.retraining_pipeline) && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-secondary" /> Retraining in Progress
            </CardTitle>
            <CardDescription className="text-xs">
              Auto-triggered by drift detection. Live progress across the retraining pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.models.filter(m => m.retraining_pipeline).map((m, i) => {
                const p = m.retraining_pipeline!;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                    className="rounded-lg border border-secondary/30 bg-secondary/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground">{m.name}</p>
                      <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/30 text-[10px]">
                        <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
                        {p.stage}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Epoch {p.current_epoch} / {p.epochs}</span>
                        <span className="font-mono font-semibold text-foreground">ETA: {p.eta}</span>
                      </div>
                      <Progress value={p.progress * 100} className="mt-1 h-1.5" />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md border border-border bg-card p-1.5">
                        <p className="text-[9px] uppercase text-muted-foreground">Data</p>
                        <p className="font-mono text-[11px] font-bold text-foreground">{p.data_points.toLocaleString()}</p>
                      </div>
                      <div className="rounded-md border border-border bg-card p-1.5">
                        <p className="text-[9px] uppercase text-muted-foreground">Epochs</p>
                        <p className="font-mono text-[11px] font-bold text-foreground">{p.current_epoch}/{p.epochs}</p>
                      </div>
                      <div className="rounded-md border border-border bg-card p-1.5">
                        <p className="text-[9px] uppercase text-muted-foreground">Val Acc</p>
                        <p className="font-mono text-[11px] font-bold text-emerald-700">{(p.validation_accuracy * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Stages */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-secondary" /> Pipeline Stages
          </CardTitle>
          <CardDescription className="text-xs">
            The retraining pipeline — checks indicate stages completed for the latest run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-stretch gap-2">
            {data.pipeline_stages.map((stage, idx) => {
              // simple rule: first 2 stages completed by default
              const completed = idx < 2;
              return (
                <div key={stage} className="flex items-center gap-2">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                    className={cn(
                      "flex min-w-[100px] flex-col items-center rounded-lg border p-2 text-center",
                      completed ? "border-emerald-300 bg-emerald-50" : "border-border bg-muted/20",
                    )}
                  >
                    <span className={cn("grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold", completed ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                      {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <p className="mt-1 text-[11px] font-semibold text-foreground">{PIPELINE_LABELS[stage] ?? stage}</p>
                  </motion.div>
                  {idx < data.pipeline_stages.length - 1 && (
                    <span className={cn("text-muted-foreground", completed ? "text-emerald-500" : "")}>→</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Retraining History */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-secondary" /> Retraining History
          </CardTitle>
          <CardDescription className="text-xs">
            Past retraining runs — before/after accuracy + trigger.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="mf-scroll max-h-[360px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-[11px]">Model</TableHead>
                  <TableHead className="text-[11px]">Date</TableHead>
                  <TableHead className="text-[11px]">Trigger</TableHead>
                  <TableHead className="text-[11px]">Before → After</TableHead>
                  <TableHead className="text-[11px]">Δ</TableHead>
                  <TableHead className="text-[11px]">Duration</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.retraining_history.map((r, i) => {
                  const delta = r.after_accuracy - r.before_accuracy;
                  const improved = delta > 0;
                  return (
                    <motion.tr
                      key={`${r.model}-${r.date}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                      className="hover:bg-muted/40"
                    >
                      <TableCell className="text-[12px] font-semibold text-foreground">{r.model}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{r.date}</TableCell>
                      <TableCell>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{r.trigger}</span>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-foreground">
                        {(r.before_accuracy * 100).toFixed(1)}% → {(r.after_accuracy * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", improved ? "text-emerald-600" : "text-red-600")}>
                        {improved ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {improved ? "+" : ""}{(delta * 100).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{r.duration}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-2.5 w-2.5" /> {r.status}
                        </span>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Alert className="mt-4 border-secondary/30 bg-secondary/5 [&>svg]:text-secondary">
        <Gauge className="h-4 w-4" />
        <AlertTitle>Continuous improvement</AlertTitle>
        <AlertDescription className="text-[12px]">
          Models self-monitor + auto-retrain. Next review: <span className="font-semibold text-foreground">{data.next_scheduled_review}</span>. Drift threshold: <span className="font-mono font-semibold text-foreground">{data.drift_threshold.toFixed(2)}</span> — anything above triggers retraining.
        </AlertDescription>
      </Alert>
    </div>
  );
}
