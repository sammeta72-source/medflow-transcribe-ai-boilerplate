"use client";
// MedFlow — Analytics with 4 tabs (Executive / Operations / Quality / Financial).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, BarChart3, Bot, Clock, Download, DollarSign, FileStack,
  RefreshCw, ShieldCheck, TrendingUp, Users, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie,
  PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/medflow/useFetch";
import { STATUS_META } from "@/lib/medflow/constants";
import { pct, usd } from "@/lib/medflow/format";
import type { JobWithRelations } from "@/lib/medflow/types";
import { EmptyState, PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";
import { toast } from "sonner";

interface DashData {
  metrics: {
    total: number; completed: number; inPipeline: number; escalated: number;
    atRisk: number; breach: number; clarifications: number; rework: number;
    stat: number; urgent: number; avgQuality: number; avgAiConf: number;
    audioMinutes: number; tatCompliance: number;
  };
  byStatus: Record<string, number>;
  bySpecialty: Record<string, number>;
  trend: { day: string; count: number }[];
  subscription: { planName?: string; audioMinutesLimit?: number; seats?: number } | null;
  usage: { audioMinutesUsed?: number; jobsProcessed?: number } | null;
}

export function Analytics() {
  const dash = useFetch<DashData>("/api/medflow/dashboard");
  const jobs = useFetch<{ jobs: JobWithRelations[] }>("/api/medflow/jobs");
  const [tab, setTab] = useState("executive");
  const loading = dash.loading || jobs.loading;
  const error = dash.error || jobs.error;

  if (loading) return (
    <div>
      <PageHeader title="Analytics" description="Cross-functional KPIs across the platform." icon={BarChart3} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !dash.data) return (
    <div>
      <PageHeader title="Analytics" description="Cross-functional KPIs across the platform." icon={BarChart3} />
      <SectionError message={error ?? "Unknown"} onRetry={() => { dash.refresh(); jobs.refresh(); }} />
    </div>
  );

  const m = dash.data.metrics;
  const subs = dash.data.subscription;
  const usage = dash.data.usage;

  const bySpecialty = Object.entries(dash.data.bySpecialty).map(([name, value], i) => ({
    name, value, color: ["#0B5345", "#1ABC9C", "#16a085", "#48C9B0", "#f4d03f", "#e67e22", "#9b59b6", "#EB984E"][i % 8],
  })).sort((a, b) => b.value - a.value);

  const byStatus = Object.entries(dash.data.byStatus).map(([name, value]) => ({
    name, value, color: STATUS_META[name as keyof typeof STATUS_META]?.color ?? "#7F8C8D",
  })).sort((a, b) => b.value - a.value);

  const tatTrend = [
    { day: "Mon", compliance: 92 },
    { day: "Tue", compliance: 95 },
    { day: "Wed", compliance: 91 },
    { day: "Thu", compliance: 88 },
    { day: "Fri", compliance: 93 },
    { day: "Sat", compliance: 90 },
    { day: "Sun", compliance: m.tatCompliance },
  ];

  const costTrend = [
    { day: "Mon", cost: 4.2, usage: 240 },
    { day: "Tue", cost: 5.1, usage: 320 },
    { day: "Wed", cost: 4.8, usage: 290 },
    { day: "Thu", cost: 6.3, usage: 410 },
    { day: "Fri", cost: 5.4, usage: 360 },
    { day: "Sat", cost: 3.9, usage: 220 },
    { day: "Sun", cost: 2.8, usage: 180 },
  ];

  function exportMock(fmt: "CSV" | "PDF") {
    toast.success(`Exported ${tab} analytics as ${fmt}`, {
      description: `Report includes metrics as of ${new Date().toLocaleString()}.`,
    });
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Cross-functional KPIs across Executive, Operations, Quality, and Financial dimensions."
        icon={BarChart3}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => exportMock("CSV")}><Download className="mr-1.5 h-3.5 w-3.5" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={() => exportMock("PDF")}><Download className="mr-1.5 h-3.5 w-3.5" /> PDF</Button>
            <Button size="sm" variant="outline" onClick={() => { dash.refresh(); jobs.refresh(); }}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="executive">Executive</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        {/* ── Executive ────────────────────────────────────────── */}
        <TabsContent value="executive" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={FileStack} label="Total volume" value={m.total} accent="text-secondary" />
            <StatCard icon={TrendingUp} label="TAT compliance" value={pct(m.tatCompliance / 100)} accent="text-emerald-600" />
            <StatCard icon={DollarSign} label="Cost / job (avg)" value={usd(0.04 * (m.audioMinutes / Math.max(1, m.total)))} accent="text-secondary" />
            <StatCard icon={Bot} label="AI confidence avg" value={pct(m.avgAiConf)} accent="text-secondary" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Volume trend (7d)</CardTitle>
                <CardDescription className="text-xs">Daily submitted jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dash.data.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="anGrad1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1ABC9C" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#1ABC9C" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="count" stroke="#0B5345" strokeWidth={2} fill="url(#anGrad1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Specialty distribution</CardTitle>
                <CardDescription className="text-xs">Jobs by specialty</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={bySpecialty} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {bySpecialty.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Operations ───────────────────────────────────────── */}
        <TabsContent value="operations" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={FileStack} label="In pipeline" value={m.inPipeline} accent="text-secondary" />
            <StatCard icon={Clock} label="At risk + breach" value={m.atRisk + m.breach} accent="text-amber-600" />
            <StatCard icon={AlertTriangle} label="Escalations" value={m.escalated} accent="text-red-600" />
            <StatCard icon={Users} label="Clarifications" value={m.clarifications} accent="text-orange-600" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Jobs by status</CardTitle>
                <CardDescription className="text-xs">Pipeline distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byStatus} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                      <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={140} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(26,188,156,0.08)" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {byStatus.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Urgent workload mix</CardTitle>
                <CardDescription className="text-xs">STAT vs Urgent vs Routine</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Routine", value: m.total - m.urgent - m.stat },
                      { name: "Urgent", value: m.urgent },
                      { name: "STAT", value: m.stat },
                    ]} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(26,188,156,0.08)" }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        <Cell fill="#94a3b8" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#ef4444" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Quality ──────────────────────────────────────────── */}
        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={ShieldCheck} label="Quality score avg" value={m.avgQuality} accent="text-emerald-600" />
            <StatCard icon={Bot} label="AI confidence" value={pct(m.avgAiConf)} accent="text-secondary" />
            <StatCard icon={TrendingUp} label="Rework jobs" value={m.rework} accent="text-amber-600" />
            <StatCard icon={AlertTriangle} label="Critical (sev)" value={jobs.data?.jobs.filter(j => j.riskSeverity === "critical").length ?? 0} accent="text-red-600" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">TAT compliance (7d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tatTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={32} domain={[80, 100]} unit="%" />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="compliance" stroke="#0B5345" strokeWidth={2.5} dot={{ fill: "#1ABC9C", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quality by specialty</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(
                        (jobs.data?.jobs ?? []).reduce<Record<string, { total: number; n: number }>>((acc, j) => {
                          const sp = j.specialty?.name ?? "Unknown";
                          if (!acc[sp]) acc[sp] = { total: 0, n: 0 };
                          if (j.qualityScore != null) { acc[sp].total += j.qualityScore; acc[sp].n++; }
                          return acc;
                        }, {}),
                      ).map(([k, v]) => ({ name: k, score: v.n ? Math.round(v.total / v.n) : 0 }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} angle={-12} height={50} textAnchor="end" />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={28} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(26,188,156,0.08)" }} />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]} fill="#16a085" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Financial ────────────────────────────────────────── */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={Clock} label="Audio minutes" value={m.audioMinutes} accent="text-secondary" sub={`of ${subs?.audioMinutesLimit ?? "—"}`} />
            <StatCard icon={FileStack} label="Jobs processed" value={usage?.jobsProcessed ?? m.total} accent="text-secondary" />
            <StatCard icon={Zap} label="AI cost (est.)" value={usd(0.04 * m.audioMinutes)} accent="text-secondary" />
            <StatCard icon={DollarSign} label="Plan" value={subs?.planName ?? "Professional"} accent="text-secondary" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cost & usage trend</CardTitle>
                <CardDescription className="text-xs">Daily AI cost (USD) vs audio minutes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={costTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="l" stroke="#0B5345" fontSize={11} tickLine={false} axisLine={false} width={32} />
                      <YAxis yAxisId="r" orientation="right" stroke="#1ABC9C" fontSize={11} tickLine={false} axisLine={false} width={36} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} />
                      <Line yAxisId="l" type="monotone" dataKey="cost" stroke="#0B5345" strokeWidth={2} dot={{ r: 3, fill: "#0B5345" }} name="Cost $" />
                      <Line yAxisId="r" type="monotone" dataKey="usage" stroke="#1ABC9C" strokeWidth={2} dot={{ r: 3, fill: "#1ABC9C" }} name="Audio min" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Subscription usage</CardTitle>
                <CardDescription className="text-xs">Audio minutes consumed vs plan limit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{usage?.audioMinutesUsed ?? m.audioMinutes} min</span>
                  <span className="text-[11px] text-muted-foreground">of {subs?.audioMinutesLimit ?? "—"} min</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${Math.min(100, ((usage?.audioMinutesUsed ?? m.audioMinutes) / (subs?.audioMinutesLimit ?? 1)) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Forecast: {(((usage?.audioMinutesUsed ?? m.audioMinutes) / Math.max(1, subs?.audioMinutesLimit ?? 1)) * 100).toFixed(0)}% of monthly limit · overage at {usd(0.05)}/min
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="font-bold text-foreground">{subs?.seats ?? "—"} seats</p>
                    <p className="text-muted-foreground">plan</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="font-bold text-emerald-600">Paid</p>
                    <p className="text-muted-foreground">invoice status</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
