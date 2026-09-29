"use client";
// MedFlow — Quality dashboard with charts + QA findings table.

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertOctagon, Bot, RefreshCw, ShieldCheck, Sparkles, TrendingDown, UserCheck,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/medflow/useFetch";
import { RISK_SEVERITY_STYLES } from "@/lib/medflow/constants";
import type { JobWithRelations } from "@/lib/medflow/types";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";

const ERROR_TYPES = [
  { type: "medication_conflict", count: 4 },
  { type: "laterality", count: 3 },
  { type: "negation", count: 2 },
  { type: "missing_section", count: 5 },
  { type: "template_mismatch", count: 1 },
  { type: "inaudible", count: 6 },
];

const SEVERITY_COLORS: Record<string, string> = {
  informational: "#94a3b8",
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

export function Quality() {
  const dash = useFetch<{
    metrics: { avgQuality: number; rework: number; total: number; completed: number; avgAiConf: number };
  }>("/api/medflow/dashboard");
  const jobsFetch = useFetch<{ jobs: JobWithRelations[] }>("/api/medflow/jobs");

  const loading = dash.loading || jobsFetch.loading;
  const error = dash.error || jobsFetch.error;

  const qaFindings = useMemo(() => {
    const rows: { job: string; severity: string; type: string; detail: string; suggestion?: string }[] = [];
    for (const j of jobsFetch.data?.jobs ?? []) {
      const rev = j.qualityReviews?.[0];
      if (!rev) continue;
      let findings: Array<{ type?: string; severity?: string; detail?: string; suggestion?: string }> = [];
      try { findings = JSON.parse(rev.findingsJson); } catch { /* ignore */ }
      for (const f of findings) {
        rows.push({
          job: j.jobNumber,
          severity: f.severity ?? "informational",
          type: f.type ?? "Finding",
          detail: f.detail ?? "",
          suggestion: f.suggestion,
        });
      }
    }
    return rows;
  }, [jobsFetch.data]);

  const scatter = useMemo(() => {
    const arr: { x: number; y: number; z: number; name: string }[] = [];
    for (const j of jobsFetch.data?.jobs ?? []) {
      if (j.aiConfidence != null && j.qualityScore != null) {
        arr.push({
          x: Math.round(j.aiConfidence * 100),
          y: j.qualityScore,
          z: 1,
          name: j.jobNumber,
        });
      }
    }
    return arr;
  }, [jobsFetch.data]);

  if (loading) return (
    <div>
      <PageHeader title="Quality" description="QA metrics, error analytics, and AI vs human accuracy." icon={ShieldCheck} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !dash.data) return (
    <div>
      <PageHeader title="Quality" description="QA metrics, error analytics, and AI vs human accuracy." icon={ShieldCheck} />
      <SectionError message={error ?? "Unknown"} onRetry={() => { dash.refresh(); jobsFetch.refresh(); }} />
    </div>
  );

  const m = dash.data.metrics;
  const passRate = m.total ? (m.completed / m.total) * 100 : 0;
  const reworkRate = m.total ? (m.rework / m.total) * 100 : 0;
  const critical = qaFindings.filter(f => f.severity === "critical" || f.severity === "high").length;

  const sevRows = Object.entries(
    qaFindings.reduce<Record<string, number>>((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([k, v]) => ({ name: k, value: v, color: SEVERITY_COLORS[k] ?? "#94a3b8" }));

  return (
    <div>
      <PageHeader
        title="Quality"
        description="QA pass-rate, error analytics, AI vs human correction trends."
        icon={ShieldCheck}
        actions={
          <Button variant="outline" size="sm" onClick={() => { dash.refresh(); jobsFetch.refresh(); }}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={ShieldCheck} label="QA pass rate" value={`${passRate.toFixed(1)}%`} accent="text-emerald-600" />
        <StatCard icon={Sparkles} label="Avg quality score" value={m.avgQuality} accent="text-secondary" />
        <StatCard icon={TrendingDown} label="Rework rate" value={`${reworkRate.toFixed(1)}%`} accent="text-amber-600" />
        <StatCard icon={AlertOctagon} label="Critical errors" value={critical} accent="text-red-600" />
      </div>

      {/* Charts row 1 */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Error types</CardTitle>
            <CardDescription className="text-xs">Findings grouped by error category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ERROR_TYPES} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="type" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} angle={-12} height={50} textAnchor="end" />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(26,188,156,0.08)" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#1ABC9C" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Error severity</CardTitle>
            <CardDescription className="text-xs">Distribution by severity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sevRows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {sevRows.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
              {sevRows.map(s => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-muted-foreground capitalize">{s.name}</span>
                  <span className="ml-auto font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI confidence vs human correction</CardTitle>
            <CardDescription className="text-xs">Each point is a job · x=AI conf · y=QA score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="AI conf" stroke="#94a3b8" fontSize={11} domain={[50, 100]} unit="%" />
                  <YAxis type="number" dataKey="y" name="QA score" stroke="#94a3b8" fontSize={11} width={28} domain={[50, 100]} />
                  <ZAxis dataKey="z" range={[60, 120]} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={scatter} fill="#0B5345" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quality score by specialty</CardTitle>
            <CardDescription className="text-xs">Avg QA score per specialty</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(
                    (jobsFetch.data?.jobs ?? []).reduce<Record<string, { total: number; n: number }>>((acc, j) => {
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
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} fill="#0B5345" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent findings table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent QA findings</CardTitle>
            <CardDescription className="text-xs">From latest QA reviews across all jobs</CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <Bot className="mr-1 h-3 w-3 text-secondary" /> {qaFindings.length} findings
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {qaFindings.length === 0 ? (
            <EmptyState icon={UserCheck} message="No QA findings — pass clean!" />
          ) : (
            <div className="max-h-[60vh] mf-scroll-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Job</TableHead>
                  <TableHead className="text-[11px]">Type</TableHead>
                  <TableHead className="text-[11px]">Severity</TableHead>
                  <TableHead className="text-[11px]">Detail</TableHead>
                  <TableHead className="text-[11px]">Suggestion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qaFindings.slice(0, 12).map((f, i) => {
                  const s = RISK_SEVERITY_STYLES[f.severity as keyof typeof RISK_SEVERITY_STYLES] ?? RISK_SEVERITY_STYLES.informational;
                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="hover:bg-muted/40"
                    >
                      <TableCell className="font-mono text-[11px] font-semibold">{f.job}</TableCell>
                      <TableCell className="text-[12px]">{f.type}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", s.badge)}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{f.detail}</TableCell>
                      <TableCell className="text-[11px] italic text-foreground/70">{f.suggestion ?? "—"}</TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
