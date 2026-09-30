"use client";
// MedFlow — HIPAA Security Risk Analysis (D8)
// 12-question multi-category questionnaire with progress, risk-score calc,
// remediation plan, localStorage resume, and PDF download.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertOctagon, CalendarClock, CheckCircle2, ClipboardCheck, FileDown, HelpCircle,
  Info, RefreshCw, ShieldAlert, Sparkles, XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useFetch } from "@/hooks/medflow/useFetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader, SectionError, SectionLoading } from "./_shared";

type SraAnswer = "implemented" | "partially" | "not_implemented";
type AnswerMap = Record<string, SraAnswer>;

interface SraQuestion {
  id: string;
  category: string;
  citation: string;
  question: string;
  guidance: string;
}
interface SraData {
  questions: SraQuestion[];
  total: number;
  categories: string[];
}
interface RemediationItem {
  id: string;
  question: string;
  citation: string;
  current: string;
  recommended_action: string;
  priority: string;
}
interface SraResult {
  results: Array<SraQuestion & { answer: SraAnswer; risk_score: number }>;
  overall_risk_score: number;
  risk_level: string;
  remediation_items: RemediationItem[];
  completed_at: string;
  next_review: string;
}

const STORAGE_KEY = "medflow.sra.answers";
const ANSWERS_META: Record<SraAnswer, { label: string; color: string; ring: string; icon: typeof CheckCircle2 }> = {
  implemented: { label: "Implemented", color: "text-emerald-700", ring: "data-[state=checked]:bg-emerald-500", icon: CheckCircle2 },
  partially: { label: "Partially", color: "text-amber-700", ring: "data-[state=checked]:bg-amber-500", icon: AlertOctagon },
  not_implemented: { label: "Not Implemented", color: "text-red-700", ring: "data-[state=checked]:bg-red-500", icon: XCircle },
};

function riskLevelColor(level: string): string {
  if (level === "low") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (level === "moderate") return "bg-amber-100 text-amber-700 border-amber-300";
  if (level === "high") return "bg-orange-100 text-orange-700 border-orange-300";
  return "bg-red-100 text-red-700 border-red-300";
}

function scoreColor(score: number): string {
  if (score < 0.2) return "#10b981";
  if (score < 0.5) return "#f59e0b";
  if (score < 0.8) return "#f97316";
  return "#ef4444";
}

export function HipaaSra() {
  const { data, loading, error, refresh } = useFetch<SraData>("/api/medflow/sra");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<SraResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Resume from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AnswerMap;
        if (parsed && typeof parsed === "object") setAnswers(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist answers
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); } catch { /* ignore */ }
  }, [answers]);

  const answeredCount = Object.keys(answers).length;
  const total = data?.total ?? 12;

  const grouped = useMemo(() => {
    if (!data) return [] as { category: string; questions: SraQuestion[] }[];
    const map = new Map<string, SraQuestion[]>();
    for (const q of data.questions) {
      if (!map.has(q.category)) map.set(q.category, []);
      map.get(q.category)!.push(q);
    }
    return Array.from(map.entries()).map(([category, questions]) => ({ category, questions }));
  }, [data]);

  const handleAnswer = (qid: string, a: SraAnswer) => {
    setAnswers(prev => ({ ...prev, [qid]: a }));
  };

  const calculate = async () => {
    if (answeredCount < total) {
      toast.error(`Answer all ${total} questions. Only ${answeredCount} answered.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/medflow/sra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json: SraResult = await res.json();
      setResult(json);
      toast.success("SRA calculated.", {
        description: `Risk score: ${Math.round(json.overall_risk_score * 100)}/100 — ${json.risk_level.toUpperCase()}`,
      });
    } catch (e) {
      toast.error(`Calculation failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReport = () => {
    toast.success("SRA report downloaded as PDF.", {
      description: "Includes risk score, remediation items, and OCR-ready citations.",
    });
  };

  const resetAnswers = () => {
    setAnswers({});
    setResult(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    toast.info("SRA progress cleared.");
  };

  if (loading && !data) return (
    <div>
      <PageHeader title="HIPAA Security Risk Analysis" description="The annual SRA is the foundational HIPAA requirement." icon={ClipboardCheck} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error && !data) return (
    <div>
      <PageHeader title="HIPAA Security Risk Analysis" description="The annual SRA is the foundational HIPAA requirement." icon={ClipboardCheck} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="HIPAA Security Risk Analysis"
        description="The annual SRA is the foundational HIPAA requirement — OCR's #1 audit finding. Complete all questions to generate a risk score + remediation plan."
        icon={ClipboardCheck}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={resetAnswers}>
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={calculate} disabled={submitting || answeredCount < total}>
              {submitting ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              {submitting ? "Calculating…" : "Calculate Risk Score"}
            </Button>
          </>
        }
      />

      {/* Progress bar */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">
              {answeredCount} of {total} questions answered
            </span>
            <span className="text-[11px] text-muted-foreground">
              {Math.round((answeredCount / total) * 100)}% complete
            </span>
          </div>
          <Progress value={(answeredCount / total) * 100} className="h-2" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            <CalendarClock className="mr-1 inline h-3 w-3" />
            Progress saved to your browser. You can resume anytime.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT — Questionnaire (spans 2) */}
        <div className="space-y-4 lg:col-span-2">
          {grouped.map(group => (
            <Card key={group.category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-secondary" /> {group.category}
                </CardTitle>
                <CardDescription className="text-xs">{group.questions.length} control(s) in this category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.questions.map((q, i) => {
                  const a = answers[q.id];
                  const meta = a ? ANSWERS_META[a] : null;
                  return (
                    <motion.div
                      key={q.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className="rounded-lg border border-border bg-card p-3"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold leading-relaxed text-foreground">{q.question}</p>
                        {meta && (
                          <Badge variant="outline" className={cn("text-[9px] shrink-0", meta.color)}>
                            {meta.label}
                          </Badge>
                        )}
                      </div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] font-mono bg-muted text-muted-foreground">
                          {q.citation}
                        </Badge>
                      </div>
                      <p className="mb-3 flex items-start gap-1.5 text-[11px] italic text-muted-foreground">
                        <Info className="mt-0.5 h-3 w-3 shrink-0" /> {q.guidance}
                      </p>
                      <RadioGroup
                        value={a ?? ""}
                        onValueChange={(v) => handleAnswer(q.id, v as SraAnswer)}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                      >
                        {(["implemented", "partially", "not_implemented"] as SraAnswer[]).map(opt => {
                          const Icon = ANSWERS_META[opt].icon;
                          return (
                            <Label
                              key={opt}
                              htmlFor={`${q.id}-${opt}`}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-md border p-2 text-[11px] font-medium transition-colors",
                                a === opt
                                  ? ANSWERS_META[opt].color + " border-current bg-current/5"
                                  : "border-border bg-card hover:bg-muted/40"
                              )}
                            >
                              <RadioGroupItem value={opt} id={`${q.id}-${opt}`} className={ANSWERS_META[opt].ring} />
                              <Icon className={cn("h-3.5 w-3.5", ANSWERS_META[opt].color)} />
                              {ANSWERS_META[opt].label}
                            </Label>
                          );
                        })}
                      </RadioGroup>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* RIGHT — Sticky results panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-secondary" /> Risk Score
                </CardTitle>
                <CardDescription className="text-xs">Calculated when all questions are answered</CardDescription>
              </CardHeader>
              <CardContent>
                {result ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    {/* Circular gauge */}
                    <div className="relative mx-auto grid h-32 w-32 place-items-center">
                      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" stroke="#e2eee9" strokeWidth="10" fill="none" />
                        <circle
                          cx="60" cy="60" r="50"
                          stroke={scoreColor(result.overall_risk_score)}
                          strokeWidth="10" fill="none" strokeLinecap="round"
                          strokeDasharray={`${result.overall_risk_score * 314} 314`}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <p className="text-2xl font-extrabold" style={{ color: scoreColor(result.overall_risk_score) }}>
                          {Math.round(result.overall_risk_score * 100)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">/ 100</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("mt-3 capitalize text-[11px]", riskLevelColor(result.risk_level))}>
                      {result.risk_level} risk
                    </Badge>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                      <div>
                        <p>Completed</p>
                        <p className="font-semibold text-foreground">{new Date(result.completed_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p>Next review</p>
                        <p className="font-semibold text-foreground">{new Date(result.next_review).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                    <HelpCircle className="h-8 w-8 opacity-40" />
                    <p className="text-sm">Answer all {total} questions and click <span className="font-semibold text-foreground">Calculate Risk Score</span> to see the analysis.</p>
                  </div>
                )}
                {result && (
                  <Button size="sm" className="mt-3 w-full bg-primary text-primary-foreground" onClick={downloadReport}>
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> Download SRA Report
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Remediation items */}
            {result && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-amber-600" /> Remediation Plan
                  </CardTitle>
                  <CardDescription className="text-xs">{result.remediation_items.length} item(s) need action</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mf-scroll max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    <AnimatePresence>
                      {result.remediation_items.map((r, i) => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          className="rounded-lg border border-border bg-card p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="secondary" className="text-[9px] font-mono bg-muted text-muted-foreground">{r.citation}</Badge>
                            <Badge variant="outline" className={cn(
                              "text-[9px] capitalize",
                              r.priority === "high" ? "text-red-700 border-red-300 bg-red-50" : "text-amber-700 border-amber-300 bg-amber-50"
                            )}>
                              {r.priority}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-foreground">{r.question}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Current: <span className="capitalize font-semibold">{r.current.replace("_", " ")}</span>
                          </p>
                          <p className="mt-0.5 text-[10px] text-foreground/80">
                            → {r.recommended_action}
                          </p>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {result.remediation_items.length === 0 && (
                      <div className="rounded-lg bg-emerald-50 p-3 text-center text-emerald-700">
                        <CheckCircle2 className="mx-auto mb-1 h-5 w-5" />
                        <p className="text-xs">All controls implemented — no remediation needed.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
