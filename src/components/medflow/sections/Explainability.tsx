"use client";
// MedFlow — AI Explainability (H8)
// Every AI decision is auditable + explainable. Required for EU AI Act (Art. 13)
// + FDA SaMD transparency. Mirrors /api/medflow/explainability response shape.

import { motion } from "framer-motion";
import {
  Brain, CheckCircle2, Eye, ListTree, RefreshCw, Scale,
  ShieldCheck, Sparkles, XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { PageHeader, SectionError, SectionLoading } from "./_shared";

// ── Types ──────────────────────────────────────────────────────────────────
interface ContributingFactor {
  factor: string;
  value: string | number | boolean;
  weight: number;
  impact: "positive" | "negative" | "critical" | string;
}
interface Alternative {
  action: string;
  confidence: number;
  rejected_reason: string;
}
interface Decision {
  id: string;
  job_number: string;
  decision: string;
  agent: string;
  confidence: number;
  timestamp: string;
  reasoning: string;
  contributing_factors: ContributingFactor[];
  alternatives: Alternative[];
  model: string;
}
interface ExplainabilityResponse {
  decisions: Decision[];
  model_explainability: {
    shap_available: boolean;
    lime_available: boolean;
    counterfactual: boolean;
    eu_ai_act_compliant: boolean;
    fda_samd_transparent: boolean;
  };
}

const DECISION_LABELS: Record<string, string> = {
  auto_route_to_qa: "Auto-Route to QA",
  escalate_to_ops_manager: "Escalate to Ops Manager",
  route_to_senior_editor_rework: "Route to Senior Editor (Rework)",
  auto_approve_and_deliver: "Auto-Approve & Deliver",
  route_to_junior_editor: "Route to Junior Editor",
};

function decisionChip(decision: string): string {
  if (decision.includes("escalate")) return "bg-red-100 text-red-700 border-red-300";
  if (decision.includes("rework")) return "bg-amber-100 text-amber-800 border-amber-300";
  if (decision.includes("auto_approve") || decision.includes("auto_route")) return "bg-emerald-100 text-emerald-700 border-emerald-300";
  return "bg-secondary/15 text-secondary border-secondary/30";
}

function impactColor(impact: string): { bar: string; text: string } {
  if (impact === "positive") return { bar: "bg-emerald-500", text: "text-emerald-700" };
  if (impact === "negative") return { bar: "bg-red-500", text: "text-red-700" };
  if (impact === "critical") return { bar: "bg-orange-500", text: "text-orange-700" };
  return { bar: "bg-slate-400", text: "text-slate-700" };
}

function fmtValue(v: string | number | boolean): string {
  if (typeof v === "number") {
    if (v <= 1 && v >= 0) return (v * 100).toFixed(0) + "%";
    return String(v);
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return v;
}

export function Explainability() {
  const { data, loading, error, refresh } = useFetch<ExplainabilityResponse>("/api/medflow/explainability");

  if (loading) {
    return (
      <div>
        <PageHeader
          title="AI Explainability"
          description="Every AI decision is auditable + explainable. Required for EU AI Act (Art. 13) + FDA SaMD transparency."
          icon={Eye}
        />
        <SectionLoading rows={4} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <PageHeader
          title="AI Explainability"
          description="Every AI decision is auditable + explainable. Required for EU AI Act (Art. 13) + FDA SaMD transparency."
          icon={Eye}
        />
        <SectionError message={error ?? "Unknown"} onRetry={refresh} />
      </div>
    );
  }

  const me = data.model_explainability;

  return (
    <div>
      <PageHeader
        title="AI Explainability"
        description="Every AI decision is auditable + explainable. Required for EU AI Act (Art. 13) + FDA SaMD transparency."
        icon={Eye}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Model Explainability callout */}
      <Alert className="border-secondary/30 bg-secondary/5 [&>svg]:text-secondary">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Model Explainability</AlertTitle>
        <AlertDescription className="text-[12px]">
          <div className="flex flex-wrap items-center gap-2">
            <ExplainChip ok={me.shap_available} label="SHAP available" />
            <ExplainChip ok={me.lime_available} label="LIME" />
            <ExplainChip ok={me.counterfactual} label="Counterfactual" />
            <ExplainChip ok={me.eu_ai_act_compliant} label="EU AI Act compliant" />
            <ExplainChip ok={me.fda_samd_transparent} label="FDA SaMD transparent" />
          </div>
        </AlertDescription>
      </Alert>

      {/* Decisions list */}
      <div className="mt-4 space-y-4">
        {data.decisions.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Brain className="h-4 w-4" />
                    </span>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-foreground">{d.job_number}</span>
                        <Badge variant="outline" className={cn("text-[10px]", decisionChip(d.decision))}>
                          {DECISION_LABELS[d.decision] ?? d.decision.replace(/_/g, " ")}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        Agent: <span className="font-mono font-medium text-foreground">{d.agent}</span>
                        {" · "}Model: <span className="font-mono font-medium text-foreground">{d.model}</span>
                        {" · "}{formatRelative(d.timestamp)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Confidence</span>
                    <span className="font-mono text-sm font-bold text-foreground">{(d.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
                {/* Confidence bar */}
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={d.confidence * 100} className="h-1.5 flex-1" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {/* Reasoning */}
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-secondary" /> Reasoning
                  </p>
                  <p className="text-[12px] leading-relaxed text-foreground">{d.reasoning}</p>
                </div>

                {/* Contributing Factors (horizontal bar chart) */}
                <div>
                  <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <ListTree className="h-3 w-3 text-secondary" /> Contributing Factors
                  </p>
                  <div className="space-y-2">
                    {d.contributing_factors.map((f, j) => {
                      const colors = impactColor(f.impact);
                      return (
                        <div key={j} className="grid grid-cols-12 items-center gap-2">
                          <div className="col-span-12 sm:col-span-4">
                            <p className="text-[11px] font-medium text-foreground">{f.factor}</p>
                            <p className="text-[10px] text-muted-foreground">value: {fmtValue(f.value)}</p>
                          </div>
                          <div className="col-span-12 flex items-center gap-2 sm:col-span-8">
                            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-muted">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${f.weight * 100}%` }}
                                transition={{ duration: 0.4, delay: 0.1 + j * 0.05 }}
                                className={cn("absolute inset-y-0 left-0 rounded-full", colors.bar)}
                              />
                            </div>
                            <span className={cn("font-mono text-[10px] font-semibold", colors.text)}>
                              weight {(f.weight * 100).toFixed(0)}%
                            </span>
                            <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase", colors.bar.replace("bg-", "border-").replace("-500", "-300"), colors.text)}>
                              {f.impact}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alternatives Considered */}
                <div>
                  <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Scale className="h-3 w-3 text-secondary" /> Alternatives Considered
                  </p>
                  {d.alternatives.length === 0 ? (
                    <p className="text-[11px] italic text-muted-foreground">No alternatives considered — single-path decision.</p>
                  ) : (
                    <div className="space-y-2">
                      {d.alternatives.map((alt, j) => (
                        <div key={j} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border bg-card p-2">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-red-500" />
                            <span className="font-mono text-[11px] font-medium text-foreground">
                              {DECISION_LABELS[alt.action] ?? alt.action.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                            <span className="text-[10px] text-muted-foreground">confidence</span>
                            <span className="font-mono text-[11px] font-semibold text-foreground">
                              {(alt.confidence * 100).toFixed(0)}%
                            </span>
                            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                              ✗ {alt.rejected_reason}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <Alert className="mt-4 border-emerald-300 bg-emerald-50 [&>svg]:text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Regulatory alignment</AlertTitle>
        <AlertDescription className="text-[12px]">
          All AI decisions logged with full reasoning + contributing factors + alternatives considered.
          SHAP, LIME, and counterfactual explanations available on-demand for any decision.
          Compliant with EU AI Act Art. 13 (transparency) + FDA SaMD transparency guidelines.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function ExplainChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        ok
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-red-300 bg-red-50 text-red-700",
      )}
    >
      {ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}
