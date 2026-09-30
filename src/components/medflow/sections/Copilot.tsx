"use client";
// MedFlow — AI Operations Copilot (A1).
// Manager-facing predictive dashboard. Calls the FastAI proxy
// POST /api/ai/copilot/summarize via fetchCopilotSummary() and renders the
// returned CopilotSummary — strictly aggregate counts + job numbers; no PHI.
// Uses local state (not useFetch) because the call is a POST + takes ~1-2s.

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, ClipboardCopy, Clock, Copy, Download, FileWarning,
  Loader2, RefreshCw, ShieldCheck, Sparkles, TrendingDown, Users, Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fetchCopilotSummary, getEmbeddedAiData } from "@/lib/medflow/api";
import { STATIC_COPILOT_SUMMARY } from "@/lib/medflow/static-data";
import type { CopilotSummary } from "@/lib/medflow/api";
import { formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader, SectionError, StatCard } from "./_shared";

const MANAGER_ROLES = [
  "Offshore Delivery Manager",
  "Client Operations Manager",
  "Onsite Coordinator",
];

const ACTION_BADGE: Record<string, string> = {
  escalate: "bg-red-100 text-red-800 border-red-300",
  expedite: "bg-amber-100 text-amber-800 border-amber-300",
  hold: "bg-slate-100 text-slate-700 border-slate-300",
  notify: "bg-emerald-100 text-emerald-700 border-emerald-300",
  reassign: "bg-teal-100 text-teal-800 border-teal-300",
};

export function Copilot() {
  // Initialize from server-embedded data (from AiDataBootstrap) — so the
  // section shows data IMMEDIATELY, no loading delay, even if runtime fetches
  // fail in published/new-tab mode.
  const embedded = getEmbeddedAiData().copilotSummary ?? STATIC_COPILOT_SUMMARY;
  const [summary, setSummary] = useState<CopilotSummary | null>(embedded);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>(MANAGER_ROLES[0]);
  const [escalating, setEscalating] = useState<string | null>(null);

  const load = useCallback(async (managerRole: string) => {
    // Don't show loading if we already have data (static/embedded fallback)
    if (!summary) setLoading(true);
    setError(null);
    try {
      const s = await fetchCopilotSummary(managerRole);
      setSummary(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(role);
  }, [role, load]);

  function handleEscalate(jobNumber: string) {
    setEscalating(jobNumber);
    setTimeout(() => {
      toast.success(`Escalated ${jobNumber}`, {
        description: "Operations Manager notified · SLA breach prevention engaged.",
      });
      setEscalating(null);
    }, 400);
  }

  function handleCopyReport() {
    if (!summary?.client_ops_report_draft) return;
    navigator.clipboard.writeText(summary.client_ops_report_draft);
    toast.success("Report copied to clipboard");
  }

  function handleDownloadReport() {
    if (!summary?.client_ops_report_draft) return;
    const blob = new Blob([summary.client_ops_report_draft], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medflow-client-ops-report-${summary.date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded as .md");
  }

  if (loading && !summary) {
    return (
      <div>
        <PageHeader
          title="AI Operations Copilot"
          description="Predictive intelligence for operations managers — uses only de-identified aggregate data (no raw PHI)."
          icon={Sparkles}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
            <p className="text-sm font-medium text-foreground">Generating predictive summary from aggregate data…</p>
            <p className="text-[11px] text-muted-foreground">medflow-copilot-v1 · FastAI agents on :8000 · no PHI exposed</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div>
        <PageHeader
          title="AI Operations Copilot"
          description="Predictive intelligence for operations managers — uses only de-identified aggregate data (no raw PHI)."
          icon={Sparkles}
        />
        <SectionError message={error ?? "Unknown"} onRetry={() => load(role)} />
      </div>
    );
  }

  const backlog = summary.daily_backlog_risk;

  return (
    <div>
      <PageHeader
        title="AI Operations Copilot"
        description="Predictive intelligence for operations managers — uses only de-identified aggregate data (no raw PHI)."
        icon={Sparkles}
        actions={
          <>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9 w-[230px] text-xs">
                <SelectValue placeholder="Manager role" />
              </SelectTrigger>
              <SelectContent>
                {MANAGER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => load(role)} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Refresh
            </Button>
          </>
        }
      />

      {/* Data minimization banner */}
      <Alert className="mb-4 border-emerald-300 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-600">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Data minimization</AlertTitle>
        <AlertDescription className="text-[12px]">
          This Copilot operates on <span className="font-semibold">aggregate counts + job numbers only</span> — no raw patient identifiers, audio, or transcripts are exposed to the LLM.
        </AlertDescription>
      </Alert>

      {/* KPI StatCards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Clock} label="In Pipeline" value={backlog.total_in_pipeline} accent="text-secondary" sub="active jobs" />
        <StatCard icon={AlertTriangle} label="At Risk" value={backlog.at_risk_count} accent="text-amber-600" sub="SLA watch" deltaTone="down" delta={`${backlog.at_risk_count}`} />
        <StatCard icon={FileWarning} label="Breach" value={backlog.breach_count} accent="text-red-600" sub="predicted" deltaTone="down" delta={`${backlog.breach_count}`} />
        <StatCard icon={Zap} label="STAT" value={backlog.stat_jobs} accent="text-orange-600" sub="priority jobs" />
        <StatCard icon={TrendingDown} label="Escalated" value={backlog.escalated_count} accent="text-red-700" sub="active" />
      </div>

      {/* SLA Breach Predictions */}
      <Card className="mt-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> SLA Breach Predictions
            </CardTitle>
            <CardDescription className="text-xs">Next 24h — ranked by predicted breach time</CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px]">{summary.sla_breach_predictions.length} predictions</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Job</TableHead>
                <TableHead className="text-[11px]">Status</TableHead>
                <TableHead className="text-[11px] min-w-[140px]">SLA used</TableHead>
                <TableHead className="text-[11px]">Breach in</TableHead>
                <TableHead className="text-[11px]">Confidence</TableHead>
                <TableHead className="text-[11px]">Action</TableHead>
                <TableHead className="text-[11px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.sla_breach_predictions.map((p, i) => {
                const breachClass = p.predicted_breach_in_hours < 2
                  ? "text-red-700"
                  : p.predicted_breach_in_hours < 6 ? "text-amber-700" : "text-foreground";
                return (
                  <motion.tr
                    key={p.job_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: i * 0.04 }}
                    className="hover:bg-muted/40"
                  >
                    <TableCell className="font-mono text-[11px] font-semibold">{p.job_number}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{p.current_status}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={p.sla_percent * 100} className="h-2 w-24" />
                        <span className="text-[10px] text-muted-foreground">{Math.round(p.sla_percent * 100)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-[11px] font-bold", breachClass)}>
                      {p.predicted_breach_in_hours.toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{Math.round(p.confidence * 100)}%</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize", ACTION_BADGE[p.recommended_action] ?? "bg-slate-100 text-slate-700 border-slate-300")}>
                        {p.recommended_action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => handleEscalate(p.job_number)}
                        disabled={escalating === p.job_number}
                      >
                        {escalating === p.job_number ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                        Escalate now
                      </Button>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* High-Rework Items + Staffing Recommendation */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileWarning className="h-4 w-4 text-orange-600" /> High-Rework Items
            </CardTitle>
            <CardDescription className="text-xs">Drivers of QA failure / rework loop</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Type</TableHead>
                  <TableHead className="text-[11px]">Name</TableHead>
                  <TableHead className="text-[11px] min-w-[140px]">Rework rate</TableHead>
                  <TableHead className="text-[11px] text-right">Jobs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.high_rework_items.map((h, i) => (
                  <motion.tr
                    key={`${h.type}-${h.name}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: i * 0.03 }}
                    className="hover:bg-muted/40"
                  >
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{h.type}</Badge>
                    </TableCell>
                    <TableCell className="text-[11px] font-semibold">{h.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={h.rework_rate_pct} className="h-2 w-24" />
                        <span className="text-[10px] font-mono text-muted-foreground">{h.rework_rate_pct.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] font-semibold">{h.job_count}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-secondary" /> Staffing Recommendation
            </CardTitle>
            <CardDescription className="text-xs">Aggregate-shift model recommendation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="text-[12px] text-muted-foreground">Current load</span>
              <span className="text-[14px] font-bold text-foreground">{summary.staffing_recommendation.current_load} jobs</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="text-[12px] text-muted-foreground">Recommended shift adjustment</span>
              <span className="text-right text-[12px] font-semibold text-foreground">{summary.staffing_recommendation.recommended_shift_adjustment}</span>
            </div>
            <div className={cn(
              "flex items-center justify-between rounded-md border px-3 py-2",
              summary.staffing_recommendation.surplus_deficit >= 0
                ? "border-emerald-300 bg-emerald-50"
                : "border-red-300 bg-red-50",
            )}>
              <span className={cn(
                "text-[12px] font-medium",
                summary.staffing_recommendation.surplus_deficit >= 0 ? "text-emerald-800" : "text-red-800",
              )}>Surplus / Deficit (FTE)</span>
              <span className={cn(
                "text-[14px] font-bold",
                summary.staffing_recommendation.surplus_deficit >= 0 ? "text-emerald-700" : "text-red-700",
              )}>
                {summary.staffing_recommendation.surplus_deficit > 0 ? "+" : ""}{summary.staffing_recommendation.surplus_deficit}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Operations Report Draft */}
      <Card className="mt-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCopy className="h-4 w-4 text-secondary" /> Client Operations Report Draft
            </CardTitle>
            <CardDescription className="text-xs">AI-drafted — review + edit before sending</CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={handleCopyReport}>
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadReport}>
              <Download className="mr-1 h-3 w-3" /> .md
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] mf-scroll overflow-y-auto rounded-lg border border-border bg-muted/20 p-4 text-[12px] leading-relaxed text-foreground">
            <pre className="whitespace-pre-wrap font-sans">{summary.client_ops_report_draft}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Generated-at footer */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Generated at <span className="font-mono font-semibold text-foreground">{formatRelative(summary.generated_at)}</span>
        </span>
        <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-2.5 w-2.5" /> Data minimized: ✓
        </Badge>
      </div>
    </div>
  );
}
