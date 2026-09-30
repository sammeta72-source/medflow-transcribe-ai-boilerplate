"use client";
// MedFlow — Autonomous SOC (C9)
// AI-driven Security Operations Center: detect + automatically respond to
// threats 24/7. Mirrors /api/medflow/autonomous-soc response shape.

import { motion } from "framer-motion";
import {
  Activity, Bot, CheckCircle2, Clock, Eye, Gauge, Radar,
  RefreshCw, ShieldAlert, ShieldCheck, Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";

// ── Types ──────────────────────────────────────────────────────────────────
interface ThreatEvent {
  id: string;
  timestamp: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical" | string;
  source: string;
  detail: string;
  auto_response: string;
  response_time_ms: number;
  status: "contained" | "resolved" | "investigating" | "monitoring" | string;
}
interface Playbook {
  id: string;
  name: string;
  trigger: string;
  actions: string[];
  auto_execute: boolean;
}
interface SocResponse {
  soc_status: string;
  autonomy_level: string;
  agents_active: number;
  threats_detected_24h: number;
  auto_responses_24h: number;
  mean_time_to_respond_ms: number;
  threat_feed: ThreatEvent[];
  response_playbooks: Playbook[];
  coverage: {
    threats_auto_responded: string;
    mean_time_to_respond: string;
    false_positive_rate: string;
  };
}

const SEVERITY_STYLES: Record<string, { border: string; dot: string; label: string }> = {
  low: { border: "border-l-emerald-400", dot: "bg-emerald-500", label: "Low" },
  medium: { border: "border-l-amber-400", dot: "bg-amber-500", label: "Medium" },
  high: { border: "border-l-orange-400", dot: "bg-orange-500", label: "High" },
  critical: { border: "border-l-red-500", dot: "bg-red-600", label: "Critical" },
  informational: { border: "border-l-slate-300", dot: "bg-slate-400", label: "Informational" },
};

const STATUS_STYLES: Record<string, { chip: string }> = {
  contained: { chip: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  resolved: { chip: "bg-teal-100 text-teal-800 border-teal-300" },
  investigating: { chip: "bg-amber-100 text-amber-800 border-amber-300" },
  monitoring: { chip: "bg-slate-100 text-slate-700 border-slate-300" },
};

const THREAT_TYPE_LABEL: Record<string, string> = {
  bulk_download: "Bulk Download",
  impossible_travel: "Impossible Travel",
  privilege_escalation: "Privilege Escalation",
  failed_login_burst: "Brute Force",
  off_hours_access: "Off-Hours Access",
  malware_detected: "Malware",
  data_exfiltration: "Data Exfiltration",
};

export function AutonomousSOC() {
  const { data, loading, error, refresh } = useFetch<SocResponse>("/api/medflow/autonomous-soc");

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Autonomous SOC"
          description="AI-driven security operations — not just detect, but automatically respond. 24/7 autonomous threat response."
          icon={Radar}
        />
        <SectionLoading rows={4} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <PageHeader
          title="Autonomous SOC"
          description="AI-driven security operations — not just detect, but automatically respond. 24/7 autonomous threat response."
          icon={Radar}
        />
        <SectionError message={error ?? "Unknown"} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Autonomous SOC"
        description="AI-driven security operations — not just detect, but automatically respond. 24/7 autonomous threat response."
        icon={Radar}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={ShieldAlert}
          label="Threats (24h)"
          value={data.threats_detected_24h}
          accent="text-red-600"
          sub="auto-detected"
        />
        <StatCard
          icon={Zap}
          label="Auto-Responses (24h)"
          value={data.auto_responses_24h}
          accent="text-emerald-600"
          sub="auto-contained"
          deltaTone="up"
        />
        <StatCard
          icon={Gauge}
          label="Mean Time to Respond"
          value={`${data.mean_time_to_respond_ms}ms`}
          accent="text-secondary"
          sub="vs 4hr human SOC"
        />
        <StatCard
          icon={Eye}
          label="False Positive Rate"
          value={data.coverage.false_positive_rate}
          accent="text-amber-600"
          sub="below 5% target"
        />
      </div>

      {/* Status Bar */}
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <Radar className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card mf-pulse" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">
                SOC Status: <span className="uppercase text-emerald-700">{data.soc_status}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Autonomy level: <span className="font-mono font-semibold text-foreground">
                  {data.autonomy_level.replace(/_/g, " ")}
                </span> · {data.agents_active} AI agents active
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 mf-pulse" /> Live
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Bot className="mr-1 h-3 w-3 text-secondary" /> {data.agents_active} agents
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Threat Feed */}
      <Card className="mt-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-secondary" /> Threat Feed
            </CardTitle>
            <CardDescription className="text-xs">
              Live reverse-chronological stream of detected threats + automated responses.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {data.threat_feed.length} events
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="mf-scroll max-h-[480px] space-y-2 overflow-y-auto p-3">
            {data.threat_feed.map((t, i) => {
              const sev = SEVERITY_STYLES[t.severity] ?? SEVERITY_STYLES.informational;
              const st = STATUS_STYLES[t.status] ?? STATUS_STYLES.monitoring;
              const typeLabel = THREAT_TYPE_LABEL[t.type] ?? t.type.replace(/_/g, " ");
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                  className={cn(
                    "rounded-lg border border-l-4 bg-card p-3 shadow-sm",
                    sev.border,
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", sev.dot)} />
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                        {typeLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelative(t.timestamp)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                        st.chip,
                      )}
                    >
                      {t.status === "contained" || t.status === "resolved"
                        ? <CheckCircle2 className="h-2.5 w-2.5" />
                        : <Eye className="h-2.5 w-2.5" />}
                      {t.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-foreground">{t.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Source: <span className="font-mono font-medium text-foreground">{t.source}</span></span>
                    <span>·</span>
                    <span>Auto-Response: <span className="font-mono font-semibold text-emerald-700">{t.auto_response}</span></span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {t.response_time_ms}ms
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Response Playbooks */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-secondary" /> Response Playbooks
          </CardTitle>
          <CardDescription className="text-xs">
            Pre-defined automated responses — auto-execute when triggered by threat signatures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.response_playbooks.map((pb, i) => (
              <motion.div
                key={pb.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-foreground">{pb.name}</p>
                  {pb.auto_execute && (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]">
                      <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> Auto-Execute ✓
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-[10px] uppercase text-muted-foreground">Trigger:</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                    {pb.trigger.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-2">
                  <p className="mb-1 text-[10px] uppercase text-muted-foreground">Actions</p>
                  <div className="flex flex-wrap gap-1">
                    {pb.actions.map((a, j) => (
                      <span
                        key={j}
                        className="rounded-full border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-[10px] font-mono text-secondary"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coverage Callout */}
      <Alert className="mt-4 border-emerald-300 bg-emerald-50 [&>svg]:text-emerald-600">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Coverage</AlertTitle>
        <AlertDescription className="text-[12px]">
          <span className="font-bold text-emerald-700">{data.coverage.threats_auto_responded}</span> of threats auto-responded.
          Mean time to respond: <span className="font-bold text-foreground">{data.coverage.mean_time_to_respond}</span>.
          False positive rate: <span className="font-bold text-amber-700">{data.coverage.false_positive_rate}</span>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
