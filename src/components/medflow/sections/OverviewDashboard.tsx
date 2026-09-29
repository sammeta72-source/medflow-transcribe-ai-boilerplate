"use client";
// MedFlow — Operations Overview dashboard.
// Pulls aggregate metrics from /api/medflow/dashboard and renders
// KPI tiles, charts (volume trend, jobs-by-status, specialty donut),
// SLA risk panel, recent activity feed, and queue snapshot.

import { motion } from "framer-motion";
import {
  AlertTriangle, Activity, ArrowDown, ArrowUp, BellRing, CheckCircle2, Clock,
  FileAudio, Inbox, LayoutDashboard, ListChecks, RefreshCw, Stethoscope,
  TrendingUp, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFetch } from "@/hooks/medflow/useFetch";
import { STATUS_META } from "@/lib/medflow/constants";
import { formatRelative, pct, usd } from "@/lib/medflow/format";
import type { JobWithRelations } from "@/lib/medflow/types";
import { EmptyState, PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";

interface DashboardData {
  metrics: {
    total: number;
    completed: number;
    inPipeline: number;
    escalated: number;
    atRisk: number;
    breach: number;
    clarifications: number;
    rework: number;
    stat: number;
    urgent: number;
    avgQuality: number;
    avgAiConf: number;
    audioMinutes: number;
    tatCompliance: number;
  };
  byStatus: Record<string, number>;
  bySpecialty: Record<string, number>;
  trend: { day: string; count: number }[];
  auditEvents: {
    id: string;
    action: string;
    actorName: string | null;
    severity: string;
    detail: string | null;
    createdAt: string;
  }[];
}

const SPARK = [0.2, 0.4, 0.3, 0.55, 0.5, 0.7, 0.8, 0.9];

export function OverviewDashboard() {
  const { data, loading, error, refresh } = useFetch<DashboardData>("/api/medflow/dashboard");
  const jobsFetch = useFetch<{ jobs: JobWithRelations[] }>("/api/medflow/jobs");

  if (loading) return (
    <div>
      <PageHeader title="Operations Overview" description="Live snapshot of dictation pipeline health." icon={LayoutDashboard} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Operations Overview" description="Live snapshot of dictation pipeline health." icon={LayoutDashboard} />
      <SectionError message={error ?? "Unknown error"} onRetry={refresh} />
    </div>
  );

  const m = data.metrics;
  const statusRows = Object.entries(data.byStatus).map(([name, value]) => ({
    name,
    value,
    color: STATUS_META[name as keyof typeof STATUS_META]?.color ?? "#7F8C8D",
  })).sort((a, b) => b.value - a.value);

  const specRows = Object.entries(data.bySpecialty).map(([name, value], i) => ({
    name, value,
    color: ["#0B5345", "#1ABC9C", "#16a085", "#48C9B0", "#f4d03f", "#e67e22", "#9b59b6", "#EB984E"][i % 8],
  })).sort((a, b) => b.value - a.value);

  // SLA risk panel: at-risk + breach jobs
  const jobs = jobsFetch.data?.jobs ?? [];
  const slaRiskJobs = jobs.filter(j => j.slaRiskLabel === "at-risk" || j.slaRiskLabel === "breach" || j.priority === "STAT");

  // Queue snapshot
  const queueSnap = [
    { label: "New work", value: m.total - m.completed - m.inPipeline > 0 ? m.total - m.completed : 0, icon: Inbox, tone: "text-amber-600" },
    { label: "Awaiting QA", value: jobs.filter(j => j.status === "Awaiting QA").length, icon: ListChecks, tone: "text-emerald-600" },
    { label: "Clarifications", value: m.clarifications, icon: BellRing, tone: "text-orange-600" },
    { label: "Delivery failures", value: 0, icon: AlertTriangle, tone: "text-red-600" },
  ];

  return (
    <div>
      <PageHeader
        title="Operations Overview"
        description="Live snapshot of dictation pipeline health — last refreshed just now."
        icon={LayoutDashboard}
        actions={
          <Button variant="outline" size="sm" onClick={() => { refresh(); jobsFetch.refresh(); }}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={FileAudio} label="Total jobs" value={m.total} delta="+12% wow" deltaTone="up" spark={SPARK} />
        <StatCard icon={Activity} label="In pipeline" value={m.inPipeline} delta="+3 today" deltaTone="up" spark={SPARK} />
        <StatCard icon={CheckCircle2} label="Delivered" value={m.completed} delta="+2 today" deltaTone="up" spark={SPARK.slice().reverse()} />
        <StatCard icon={TrendingUp} label="SLA compliance" value={pct(m.tatCompliance / 100)} delta="-1.4%" deltaTone="down" accent="text-amber-600" spark={[0.95, 0.92, 0.94, 0.91, 0.93, 0.90, 0.88]} />
        <StatCard icon={Stethoscope} label="Avg quality score" value={m.avgQuality} delta="+0.6" deltaTone="up" spark={SPARK} />
        <StatCard icon={AlertTriangle} label="Escalations" value={m.escalated} delta="+1 today" deltaTone="down" accent="text-red-600" spark={[0.1, 0.2, 0.15, 0.3, 0.4, 0.5, 0.55]} />
      </div>

      {/* Charts row */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Volume trend */}
        <Card className="md:col-span-1 lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Volume trend (last 7 days)</CardTitle>
                <CardDescription className="text-xs">Jobs submitted per day</CardDescription>
              </div>
              <Badge variant="outline" className="text-secondary border-secondary/40">
                <TrendingUp className="mr-1 h-3 w-3" /> Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mfGradVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1ABC9C" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#1ABC9C" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke="#0B5345" strokeWidth={2} fill="url(#mfGradVolume)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Specialty donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Specialty distribution</CardTitle>
            <CardDescription className="text-xs">By current workload</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={specRows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {specRows.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
              {specRows.slice(0, 6).map(s => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="ml-auto font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: jobs-by-status bar + SLA risk + activity */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Jobs by status */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Jobs by status</CardTitle>
            <CardDescription className="text-xs">Current pipeline distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusRows} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={140} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(26,188,156,0.08)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {statusRows.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Queue snapshot */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Queue snapshot</CardTitle>
            <CardDescription className="text-xs">Counts by queue state</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {queueSnap.map(q => (
              <div key={q.label} className="rounded-xl border border-border bg-muted/30 p-3">
                <q.icon className={`h-4 w-4 ${q.tone}`} />
                <p className="mt-2 text-2xl font-bold">{q.value}</p>
                <p className="text-[11px] text-muted-foreground">{q.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* SLA risk + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* SLA risk panel */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">SLA risk panel</CardTitle>
                <CardDescription className="text-xs">At-risk, breach, and STAT jobs</CardDescription>
              </div>
              <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                {slaRiskJobs.length} jobs
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {slaRiskJobs.length === 0 ? (
              <EmptyState icon={CheckCircle2} message="No at-risk jobs — all SLAs on track." />
            ) : (
              <ul className="max-h-80 space-y-2 mf-scroll overflow-y-auto pr-1">
                {slaRiskJobs.slice(0, 10).map(j => {
                  const tone =
                    j.slaRiskLabel === "breach" ? "bg-red-500"
                    : j.slaRiskLabel === "at-risk" ? "bg-amber-500"
                    : "bg-slate-400";
                  return (
                    <li key={j.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                      <span className={`h-2 w-2 rounded-full ${tone}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {j.jobNumber} · {j.documentType}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {j.patientRef} · {j.provider?.name ?? "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] font-medium text-foreground">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {new Date(j.slaDeadline ?? Date.now()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{j.priority}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription className="text-xs">Audit feed (last 8 events)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.auditEvents.length === 0 ? (
              <EmptyState icon={Activity} message="No recent activity." />
            ) : (
              <ul className="max-h-80 space-y-2 mf-scroll overflow-y-auto pr-1">
                {data.auditEvents.map((e, i) => {
                  const tone =
                    e.severity === "critical" ? "bg-red-500"
                    : e.severity === "warning" ? "bg-amber-500"
                    : "bg-emerald-500";
                  const initials = (e.actorName ?? "S").split(" ").map(s => s[0]).slice(0, 2).join("");
                  return (
                    <motion.li
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/40"
                    >
                      <Avatar className="h-7 w-7 border border-border">
                        <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-foreground">
                          <span className="font-semibold">{e.actorName ?? "System"}</span>
                          <span className="text-muted-foreground"> · {e.action}</span>
                        </p>
                        {e.detail && <p className="truncate text-[11px] text-muted-foreground">{e.detail}</p>}
                        <p className="text-[10px] text-muted-foreground/80">{formatRelative(e.createdAt)}</p>
                      </div>
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone}`} />
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tiny cost / audio meter */}
      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Pipeline totals</p>
              <p className="text-[11px] text-muted-foreground">
                {m.audioMinutes.toFixed(0)} audio minutes · {m.avgAiConf > 0 ? pct(m.avgAiConf) : "—"} AI confidence · {m.avgQuality}/100 QA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3 text-emerald-600" />
              <span className="font-semibold">{m.completed}</span>
              <span className="text-muted-foreground">delivered</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowDown className="h-3 w-3 text-red-600" />
              <span className="font-semibold">{m.escalated + m.breach}</span>
              <span className="text-muted-foreground">escalated / breach</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold">{usd(0.04 * m.audioMinutes)}</span>
              <span className="text-muted-foreground">est. AI cost</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
