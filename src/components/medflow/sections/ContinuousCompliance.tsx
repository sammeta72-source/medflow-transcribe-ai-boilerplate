"use client";
// MedFlow — Continuous Compliance (D1 + D2).
// D1: Live control monitoring — pulls /api/medflow/controls which queries
// real DB signals (audit_events, users, alerts, integrations) to evaluate
// 16 controls across HIPAA / GDPR / 21 CFR 11 / ISO 27001 / ISO 13485 / etc.
// D2: 1-Click Audit Pack Generator — POST /api/medflow/audit-pack returns
// a downloadable bundle of filtered audit events + control mappings.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck, CheckCircle2, Clock, Download, FileArchive, Loader2, RefreshCw,
  ShieldCheck, Sparkles, TriangleAlert, Wrench, XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";

interface ControlStatus {
  id: string;
  name: string;
  framework: string;
  citation: string;
  tier: 1 | 2 | 3;
  description?: string;
  status: "pass" | "warn" | "fail";
  evidence: string[];
  last_checked: string;
}

interface ControlsResponse {
  controls: ControlStatus[];
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
    coverage_pct: number;
    last_full_audit: string;
    next_audit: string;
    tiers: { tier1: string; tier2: string; tier3: string };
  };
  system_signals: {
    audit_events: number;
    users: number;
    notifications: number;
    security_alerts: number;
    integrations: number;
    subscriptions: number;
  };
  generated_at: string;
}

interface AuditPack {
  pack_id: string;
  generated_at: string;
  summary: {
    total_audit_events: number;
    total_security_alerts: number;
    total_notifications: number;
    severity_breakdown: { info: number; warning: number; critical: number };
    alert_status_breakdown: { open: number; acknowledged: number; resolved: number };
  };
  controls_coverage: Record<string, string>;
  [k: string]: unknown;
}

const FRAMEWORK_BADGE: Record<string, string> = {
  HIPAA: "bg-emerald-100 text-emerald-700 border-emerald-300",
  GDPR: "bg-teal-100 text-teal-800 border-teal-300",
  "21 CFR 11": "bg-orange-100 text-orange-800 border-orange-300",
  "ISO 27001": "bg-slate-100 text-slate-700 border-slate-300",
  "ISO 13485": "bg-amber-100 text-amber-800 border-amber-300",
  "ISO 14971": "bg-amber-100 text-amber-800 border-amber-300",
  "EU MDR": "bg-rose-100 text-rose-800 border-rose-300",
  HITRUST: "bg-violet-100 text-violet-800 border-violet-300",
  "SOC 2": "bg-cyan-100 text-cyan-800 border-cyan-300",
};

const TIER_BADGE: Record<number, string> = {
  1: "bg-emerald-50 text-emerald-700 border-emerald-300",
  2: "bg-amber-50 text-amber-700 border-amber-300",
  3: "bg-slate-50 text-slate-700 border-slate-300",
};

const STATUS_META: Record<string, { icon: typeof CheckCircle2; color: string; label: string; chip: string }> = {
  pass: { icon: CheckCircle2, color: "text-emerald-600", label: "Pass", chip: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  warn: { icon: TriangleAlert, color: "text-amber-600", label: "Warn", chip: "bg-amber-100 text-amber-700 border-amber-300" },
  fail: { icon: XCircle, color: "text-red-600", label: "Fail", chip: "bg-red-100 text-red-700 border-red-300" },
};

const FRAMEWORKS = ["all", "HIPAA", "GDPR", "21 CFR 11", "ISO 27001", "ISO 13485"];

export function ContinuousCompliance() {
  const { data, loading, error, refresh } = useFetch<ControlsResponse>("/api/medflow/controls");

  const [scope, setScope] = useState("all");
  const [framework, setFramework] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pack, setPack] = useState<AuditPack | null>(null);
  const [sortFramework, setSortFramework] = useState("all");
  const [sortStatus, setSortStatus] = useState("all");

  const sortedControls = useMemo(() => {
    if (!data?.controls) return [];
    return data.controls
      .filter(c => sortFramework === "all" || c.framework === sortFramework)
      .filter(c => sortStatus === "all" || c.status === sortStatus);
  }, [data, sortFramework, sortStatus]);

  async function handleGeneratePack() {
    setGenerating(true);
    setPack(null);
    try {
      const res = await fetch("/api/medflow/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          framework: framework === "all" ? undefined : framework,
        }),
      });
      if (!res.ok) throw new Error(`audit-pack failed: ${res.status}`);
      const json: AuditPack = await res.json();
      setPack(json);
      toast.success("Audit pack generated", {
        description: `${json.summary.total_audit_events} events · ${json.summary.total_security_alerts} alerts · ${Object.keys(json.controls_coverage).length} frameworks covered`,
      });
    } catch (e) {
      toast.error(`Audit pack failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  function handleDownloadPack() {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medflow-audit-pack-${Date.now().toString(36)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Audit pack downloaded", { description: `${pack.pack_id}.json` });
  }

  if (loading) return (
    <div>
      <PageHeader title="Continuous Compliance" description="Live, always-on control monitoring — replaces periodic audit prep with continuous assurance." icon={BadgeCheck} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Continuous Compliance" description="Live, always-on control monitoring — replaces periodic audit prep with continuous assurance." icon={BadgeCheck} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  const s = data.summary;

  return (
    <div>
      <PageHeader
        title="Continuous Compliance"
        description="Live, always-on control monitoring — replaces periodic audit prep with continuous assurance."
        icon={BadgeCheck}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Summary bar — 4 StatCards + tier breakdown */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={BadgeCheck} label="Total Controls" value={s.total} accent="text-secondary" sub={`${data.controls.length} monitored`} />
        <StatCard icon={CheckCircle2} label="Passing" value={s.pass} accent="text-emerald-600" sub={`${Math.round((s.pass / s.total) * 100)}% pass`} deltaTone="up" delta={`${s.pass}`} />
        <StatCard icon={TriangleAlert} label="Warning" value={s.warn} accent="text-amber-600" sub="needs review" deltaTone="down" delta={`${s.warn}`} />
        <StatCard icon={ShieldCheck} label="Coverage" value={`${s.coverage_pct}%`} accent="text-secondary" sub="passing-rate" />
      </div>

      <Card className="mt-4">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <TierBreakdown label="Tier 1 — Regulatory" value={s.tiers.tier1} />
          <TierBreakdown label="Tier 2 — ISMS / QMS" value={s.tiers.tier2} />
          <TierBreakdown label="Tier 3 — Med-device" value={s.tiers.tier3} />
        </CardContent>
      </Card>

      {/* 1-Click Audit Pack Generator */}
      <Card className="mt-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileArchive className="h-4 w-4 text-secondary" /> Generate Audit Pack
            </CardTitle>
            <CardDescription className="text-xs">1-click evidence bundle — admissible as audit evidence (hash-chain verified)</CardDescription>
          </div>
          {pack && (
            <Button size="sm" className="bg-secondary text-secondary-foreground" onClick={handleDownloadPack}>
              <Download className="mr-1 h-3 w-3" /> Download JSON
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scope</label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (full)</SelectItem>
                  <SelectItem value="hipaa">HIPAA</SelectItem>
                  <SelectItem value="gdpr">GDPR</SelectItem>
                  <SelectItem value="21cfr11">21 CFR 11</SelectItem>
                  <SelectItem value="iso27001">ISO 27001</SelectItem>
                  <SelectItem value="iso13485">ISO 13485</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Framework filter</label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FRAMEWORKS.map(f => <SelectItem key={f} value={f}>{f === "all" ? "All frameworks" : f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Start date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">End date</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleGeneratePack} disabled={generating} className="bg-primary text-primary-foreground">
              {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileArchive className="mr-1.5 h-3.5 w-3.5" />}
              Generate Audit Pack
            </Button>
            {pack && (
              <Badge variant="outline" className="gap-1 text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-2.5 w-2.5" /> {pack.pack_id}
              </Badge>
            )}
          </div>

          {pack && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 sm:grid-cols-4"
            >
              <PackStat label="Audit events" value={pack.summary.total_audit_events} />
              <PackStat label="Security alerts" value={pack.summary.total_security_alerts} />
              <PackStat label="Notifications" value={pack.summary.total_notifications} />
              <PackStat label="Frameworks covered" value={Object.keys(pack.controls_coverage).length} />
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Controls Matrix */}
      <Card className="mt-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Controls Matrix</CardTitle>
            <CardDescription className="text-xs">{data.controls.length} controls · live status from system signals</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortFramework} onValueChange={setSortFramework}>
              <SelectTrigger className="h-8 w-32 text-[11px]"><SelectValue placeholder="Framework" /></SelectTrigger>
              <SelectContent>
                {["all", "HIPAA", "GDPR", "21 CFR 11", "ISO 27001", "ISO 13485", "ISO 14971", "EU MDR", "HITRUST", "SOC 2"].map(f => <SelectItem key={f} value={f}>{f === "all" ? "All frameworks" : f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortStatus} onValueChange={setSortStatus}>
              <SelectTrigger className="h-8 w-28 text-[11px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="pass">Pass</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="fail">Fail</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[560px] mf-scroll overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-[11px]">Control</TableHead>
                  <TableHead className="text-[11px]">Framework</TableHead>
                  <TableHead className="text-[11px]">Tier</TableHead>
                  <TableHead className="text-[11px]">Status</TableHead>
                  <TableHead className="text-[11px]">Evidence</TableHead>
                  <TableHead className="text-[11px]">Last checked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedControls.map((c, i) => {
                  const sm = STATUS_META[c.status];
                  const Icon = sm.icon;
                  return (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="hover:bg-muted/40"
                    >
                      <TableCell>
                        <p className="text-[12px] font-semibold text-foreground">{c.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{c.citation}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", FRAMEWORK_BADGE[c.framework] ?? "bg-slate-100 text-slate-700 border-slate-300")}>
                          {c.framework}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", TIER_BADGE[c.tier])}>Tier {c.tier}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", sm.chip)}>
                          <Icon className="h-2.5 w-2.5" /> {sm.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.evidence.map((e, j) => (
                            <span key={j} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-foreground/70">{e}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{formatRelative(c.last_checked)}</TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Audit readiness callout */}
      <Alert className="mt-4 border-secondary/30 bg-secondary/5 [&>svg]:text-secondary">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Audit readiness</AlertTitle>
        <AlertDescription className="text-[12px]">
          Next audit: <span className="font-semibold text-foreground">{s.next_audit}</span> · Last full audit: <span className="font-semibold text-foreground">{s.last_full_audit}</span> · Coverage: <span className="font-semibold text-foreground">{s.coverage_pct}%</span>
        </AlertDescription>
      </Alert>

      {/* System Signals footer */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">System Signals</CardTitle>
          <CardDescription className="text-xs">Live counts feeding control evaluation</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <SignalStat label="Audit events" value={data.system_signals.audit_events} />
          <SignalStat label="Users" value={data.system_signals.users} />
          <SignalStat label="Notifications" value={data.system_signals.notifications} />
          <SignalStat label="Security alerts" value={data.system_signals.security_alerts} />
          <SignalStat label="Integrations" value={data.system_signals.integrations} />
          <SignalStat label="Subscriptions" value={data.system_signals.subscriptions} />
        </CardContent>
      </Card>

      {/* ── Auto-Remediation (E8) — additive enhancement ───────────────── */}
      <AutoRemediationPanel />
    </div>
  );
}

// ── Auto-Remediation (E8) ────────────────────────────────────────────────────
// Compliance failures are auto-fixed where safe; ambiguous items are escalated.
// Mirrors /api/medflow/auto-remediation response shape.

interface RemediationLogRow {
  id: string;
  timestamp: string;
  control: string;
  severity: string;
  auto_action: string;
  status: string;
  control_id: string;
}

interface PendingRemediationRow {
  id: string;
  control: string;
  severity: string;
  proposed_action: string;
  requires_human: boolean;
}

interface AutoRemediationResponse {
  auto_remediation_enabled: boolean;
  total_auto_fixed_30d: number;
  pending_remediation: number;
  remediation_log: RemediationLogRow[];
  pending: PendingRemediationRow[];
}

const REMEDIATION_STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  in_progress: "bg-amber-100 text-amber-800 border-amber-300",
  pending: "bg-slate-100 text-slate-700 border-slate-300",
  failed: "bg-red-100 text-red-700 border-red-300",
};

const REMEDIATION_SEVERITY_STYLES: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-700 border-red-300",
};

function AutoRemediationPanel() {
  const { data, loading, error, refresh } = useFetch<AutoRemediationResponse>("/api/medflow/auto-remediation");

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-secondary" /> Auto-Remediation
          </CardTitle>
          <CardDescription className="text-xs">
            Compliance failures fixed automatically — safe actions executed, ambiguous items escalated to humans.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            data?.auto_remediation_enabled
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-border bg-muted text-muted-foreground",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", data?.auto_remediation_enabled ? "bg-emerald-500 mf-pulse" : "bg-muted-foreground")} />
            {data?.auto_remediation_enabled ? "ENABLED" : "DISABLED"}
          </span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SectionLoading rows={3} />
        ) : error || !data ? (
          <SectionError message={error ?? "Unknown"} onRetry={refresh} />
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <AutoRemStat label="Total Auto-Fixed (30d)" value={data.total_auto_fixed_30d} tone="emerald" icon={CheckCircle2} />
              <AutoRemStat label="Pending Remediation" value={data.pending_remediation} tone="amber" icon={Clock} />
              <AutoRemStat label="Remediation Log Entries" value={data.remediation_log.length} tone="secondary" icon={Wrench} />
            </div>

            {/* Remediation Log Table */}
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Remediation Log
              </p>
              <div className="mf-scroll max-h-[400px] overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="text-[11px]">Timestamp</TableHead>
                      <TableHead className="text-[11px]">Control</TableHead>
                      <TableHead className="text-[11px]">Severity</TableHead>
                      <TableHead className="text-[11px]">Auto-Action</TableHead>
                      <TableHead className="text-[11px]">Status</TableHead>
                      <TableHead className="text-[11px]">Control ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.remediation_log.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: i * 0.03 }}
                        className="hover:bg-muted/40"
                      >
                        <TableCell className="text-[11px] text-muted-foreground">{formatRelative(row.timestamp)}</TableCell>
                        <TableCell>
                          <p className="text-[12px] text-foreground">{row.control}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{row.control_id}</p>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                            REMEDIATION_SEVERITY_STYLES[row.severity] ?? "bg-muted text-muted-foreground border-border",
                          )}>
                            {row.severity}
                          </span>
                        </TableCell>
                        <TableCell className="text-[11px] text-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-secondary" /> {row.auto_action}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                            REMEDIATION_STATUS_STYLES[row.status] ?? "bg-muted text-muted-foreground border-border",
                          )}>
                            {row.status === "completed" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                            {row.status.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{row.control_id}</TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pending (Requires Human) */}
            {data.pending.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <TriangleAlert className="h-3 w-3 text-amber-600" /> Pending (Requires Human)
                </p>
                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px]">Control</TableHead>
                        <TableHead className="text-[11px]">Severity</TableHead>
                        <TableHead className="text-[11px]">Proposed Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pending.map(row => (
                        <TableRow key={row.id} className="hover:bg-amber-50/60">
                          <TableCell className="text-[12px] text-foreground">{row.control}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                              REMEDIATION_SEVERITY_STYLES[row.severity] ?? "bg-muted text-muted-foreground border-border",
                            )}>
                              {row.severity}
                            </span>
                          </TableCell>
                          <TableCell className="text-[11px] text-foreground">{row.proposed_action}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AutoRemStat({ label, value, tone, icon: Icon }: { label: string; value: number; tone: "emerald" | "amber" | "secondary"; icon: typeof CheckCircle2 }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-700 bg-emerald-50" :
    tone === "amber" ? "text-amber-700 bg-amber-50" :
    "text-secondary bg-secondary/10";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 place-items-center rounded-full", toneClass)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-xl font-extrabold text-foreground">{value}</p>
    </div>
  );
}

// NOTE: AutoRemediationPanel intentionally consumes the same hook module paths
// (`@/hooks/medflow/useFetch`, `@/lib/medflow/format`, `framer-motion`, `sonner`)
// already imported at the top of this file.

function TierBreakdown({ label, value }: { label: string; value: string }) {
  const [pass, total] = value.split("/").map(n => Number(n));
  const pctVal = total > 0 ? (pass / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <Progress value={pctVal} className="mt-2 h-1.5" />
    </div>
  );
}

function PackStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold text-emerald-800">{value}</p>
    </div>
  );
}

function SignalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-base font-bold text-foreground">{value}</p>
    </div>
  );
}
