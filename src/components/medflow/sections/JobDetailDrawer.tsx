"use client";
// MedFlow — Job detail drawer (right-side Sheet, wide, with tabs).

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Bot, CheckCircle2, ClipboardCopy, Clock, FileJson,
  FileText, ListTree, MessageCircleQuestion, Mic, Pencil, Play, RefreshCw, Send,
  ShieldCheck, Stethoscope, ThumbsUp, XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runAgent, fetchFhir, fetchHl7 } from "@/lib/medflow/api";
import {
  PRIORITY_STYLES, RISK_SEVERITY_STYLES, STATUS_META,
} from "@/lib/medflow/constants";
import {
  formatDateTime, formatDuration, formatRelative, formatSlaRemaining, pct,
} from "@/lib/medflow/format";
import type { JobWithRelations } from "@/lib/medflow/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  job: JobWithRelations | null;
  onClose: () => void;
  onAdvanced: () => void;
}

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "transcript", label: "Transcript", icon: Mic },
  { id: "structured", label: "Structured Doc", icon: ClipboardCopy },
  { id: "qa", label: "QA Findings", icon: ShieldCheck },
  { id: "timeline", label: "Timeline", icon: ListTree },
  { id: "delivery", label: "Delivery", icon: Send },
];

export function JobDetailDrawer({ job, onClose, onAdvanced }: Props) {
  const [tab, setTab] = useState("overview");
  const [running, setRunning] = useState<string | null>(null);
  const [fhirOpen, setFhirOpen] = useState(false);
  const [hl7Open, setHl7Open] = useState(false);
  const [fhirPayload, setFhirPayload] = useState<string>("");
  const [hl7Payload, setHl7Payload] = useState<string>("");

  useEffect(() => { if (job) setTab("overview"); }, [job]);

  if (!job) return null;
  const statusMeta = STATUS_META[job.status] ?? STATUS_META.Draft;
  const priorityStyle = PRIORITY_STYLES[job.priority];
  const sla = formatSlaRemaining(job.slaDeadline);
  const slaToneClass =
    sla.tone === "danger" ? "text-red-600"
    : sla.tone === "warn" ? "text-amber-600"
    : "text-emerald-600";

  async function handleRunAgent(agentId: string, label: string) {
    setRunning(agentId);
    try {
      const run = await runAgent(agentId, job!.jobNumber);
      const out = run.output ?? {};
      let summary = "Agent finished";
      if (agentId === "transcription") {
        const conf = typeof out.confidence === "number" ? pct(out.confidence) : "—";
        const txt = typeof out.transcript === "string" ? out.transcript.slice(0, 80) : JSON.stringify(out);
        summary = `Transcription ${conf} confidence · ${txt}…`;
      } else if (agentId === "qa") {
        const qs = typeof out.quality_score === "number" ? out.quality_score : "—";
        const rs = typeof out.risk_severity === "string" ? out.risk_severity : "—";
        const fc = Array.isArray(out.findings) ? out.findings.length : 0;
        summary = `QA score ${qs} · risk ${rs} · ${fc} findings`;
      } else if (agentId === "allocation") {
        const an = typeof out.assigned_user_name === "string" ? out.assigned_user_name : "—";
        summary = `Allocated to ${an}`;
      } else if (agentId === "delivery") {
        summary = typeof out.method === "string" ? `Delivered via ${out.method}` : "Delivered";
      } else {
        summary = `${label} succeeded · ${run.duration_ms}ms · ${run.cost_usd.toFixed(4)} cost`;
      }
      toast.success(`${label} ran successfully`, { description: summary });
      onAdvanced();
    } catch (e) {
      console.error(e);
      toast.error(`${label} failed`, { description: (e as Error).message });
    } finally {
      setRunning(null);
    }
  }

  async function handleViewFhir() {
    setFhirOpen(true);
    setFhirPayload("Loading…");
    try {
      const payload = await fetchFhir(job!.jobNumber);
      setFhirPayload(JSON.stringify(payload, null, 2));
    } catch (e) {
      setFhirPayload(`Error: ${(e as Error).message}`);
    }
  }
  async function handleViewHl7() {
    setHl7Open(true);
    setHl7Payload("Loading…");
    try {
      const payload = await fetchHl7(job!.jobNumber);
      setHl7Payload(payload);
    } catch (e) {
      setHl7Payload(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <Sheet open={!!job} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="right" className="w-full flex flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl" style={{}}>
          {/* Header */}
          <div className="border-b border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{job.jobNumber}</p>
                <h2 className="text-lg font-bold text-foreground">{job.documentType}</h2>
                <p className="text-sm text-muted-foreground">
                  {job.patientRef ?? "Unknown"} · {job.provider?.name ?? "—"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge
                  variant="outline"
                  className="border-l-4 font-semibold"
                  style={{ borderLeftColor: statusMeta.color }}
                >
                  {statusMeta.label}
                </Badge>
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", priorityStyle.badge)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", priorityStyle.dot)} /> {job.priority}
                </span>
              </div>
            </div>
            {/* SLA strip */}
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-xs">
              <Clock className={cn("h-3.5 w-3.5", slaToneClass)} />
              <span className={cn("font-semibold", slaToneClass)}>{sla.text}</span>
              {job.slaDeadline && (
                <span className="text-muted-foreground">
                  · due {formatDateTime(job.slaDeadline)}
                </span>
              )}
              {job.aiConfidence != null && (
                <Badge variant="outline" className="ml-auto gap-1 text-[10px]">
                  <Bot className="h-3 w-3 text-secondary" /> {pct(job.aiConfidence)}
                </Badge>
              )}
              {job.qualityScore != null && (
                <Badge variant="outline" className="text-[10px]">QA {job.qualityScore}</Badge>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-border bg-card px-3">
              <TabsList className="h-auto bg-transparent p-0">
                {TABS.map(t => (
                  <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-[12px]">
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto">
              {/* ── Overview ─────────────────────────── */}
              <TabsContent value="overview" className="m-0 p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MetaTile label="Provider" value={job.provider?.name ?? "—"} />
                  <MetaTile label="Facility" value={job.facility?.name ?? "—"} />
                  <MetaTile label="Department" value={job.department?.name ?? "—"} />
                  <MetaTile label="Specialty" value={job.specialty?.name ?? "—"} />
                  <MetaTile label="Document type" value={job.documentType} />
                  <MetaTile label="Encounter" value={job.encounterRef ?? "—"} />
                  <MetaTile label="Audio file" value={job.audioFileName ?? "—"} />
                  <MetaTile label="Audio duration" value={formatDuration(job.audioDurationSec)} />
                  <MetaTile label="Delivery dest" value={job.deliveryDest ?? "—"} />
                </div>

                {job.clientInstructions && (
                  <Card className="mt-3">
                    <CardContent className="p-3 text-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client instructions</p>
                      <p className="mt-1 text-foreground">{job.clientInstructions}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Audio player mock */}
                <Card className="mt-3">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" aria-label="Play audio">
                        <Play className="h-4 w-4" />
                      </Button>
                      <div className="flex h-8 flex-1 items-end gap-0.5">
                        {Array.from({ length: 48 }).map((_, i) => (
                          <span
                            key={i}
                            className={cn("flex-1 rounded-sm bg-secondary/70", i < 14 && "bg-secondary")}
                            style={{ height: `${15 + Math.abs(Math.sin(i * 0.6)) * 80}%` }}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        0:42 / {formatDuration(job.audioDurationSec)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* AI confidence ring */}
                <Card className="mt-3">
                  <CardContent className="flex items-center gap-4 p-3">
                    <ConfidenceRing value={job.aiConfidence ?? 0} />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI confidence</p>
                      <p className="text-sm font-bold text-foreground">
                        {pct(job.aiConfidence ?? 0)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        whisper-large-v3 · v2.4.1
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Action buttons */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Button onClick={() => handleAction("advance", "Advance workflow")} className="bg-primary text-primary-foreground">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Advance workflow
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRunAgent("transcription", "Transcription Agent")}
                    disabled={running === "transcription"}
                  >
                    {running === "transcription" ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bot className="mr-1.5 h-3.5 w-3.5" />}
                    Run transcription
                  </Button>
                  <Button variant="outline" onClick={() => handleAction("clarify", "Clarification requested")}>
                    <MessageCircleQuestion className="mr-1.5 h-3.5 w-3.5" /> Request clarification
                  </Button>
                  <Button variant="outline" onClick={() => handleAction("escalate", "Escalated")}>
                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Escalate
                  </Button>
                  <Button variant="outline" onClick={() => handleAction("rework", "QA rework")}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" /> QA rework
                  </Button>
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => handleAction("approve", "Approved")}
                    disabled={job.status === "Delivered"}
                  >
                    <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Approve & deliver
                  </Button>
                </div>
              </TabsContent>

              {/* ── Transcript ──────────────────────────── */}
              <TabsContent value="transcript" className="m-0 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Bot className="h-3 w-3 text-secondary" /> {pct(job.aiConfidence ?? 0)} AI confidence
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">whisper-large-v3</Badge>
                </div>
                <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 font-mono text-[12px] leading-relaxed text-foreground">
{job.transcriptText ?? "No transcript yet — run the Transcription Agent."}
                </pre>
              </TabsContent>

              {/* ── Structured doc ───────────────────────── */}
              <TabsContent value="structured" className="m-0 p-4">
                <StructuredDoc job={job} />
              </TabsContent>

              {/* ── QA findings ───────────────────────────── */}
              <TabsContent value="qa" className="m-0 p-4">
                <QaFindings job={job} />
              </TabsContent>

              {/* ── Timeline ─────────────────────────────── */}
              <TabsContent value="timeline" className="m-0 p-4">
                <Timeline job={job} />
              </TabsContent>

              {/* ── Delivery ─────────────────────────────── */}
              <TabsContent value="delivery" className="m-0 p-4">
                <div className="space-y-3">
                  {job.status === "Delivered" || job.status === "Approved" ? (
                    <>
                      <Card>
                        <CardContent className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <div>
                              <p className="font-semibold text-foreground">Delivered via {job.deliveryDest ?? "FHIR R4"}</p>
                              <p className="text-[11px] text-muted-foreground">1 delivery attempt · succeeded · {formatRelative(job.updatedAt)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleViewFhir}>
                          <FileJson className="mr-1.5 h-3.5 w-3.5" /> View FHIR payload
                        </Button>
                        <Button variant="outline" onClick={handleViewHl7}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" /> View HL7 message
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
                      <Send className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Not yet delivered</p>
                      <p className="text-[11px] text-muted-foreground">Approve & deliver to generate FHIR / HL7 payloads.</p>
                      <Button className="mt-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleAction("approve", "Approved")}>
                        <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Approve & deliver
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* FHIR dialog */}
      <Dialog open={fhirOpen} onOpenChange={setFhirOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-secondary" /> FHIR R4 Bundle — {job.jobNumber}
            </DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
{fhirPayload}
          </pre>
        </DialogContent>
      </Dialog>

      {/* HL7 dialog */}
      <Dialog open={hl7Open} onOpenChange={setHl7Open}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-secondary" /> HL7 v2 MDM Message — {job.jobNumber}
            </DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
{hl7Payload}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );

  async function handleAction(action: string, label: string) {
    try {
      const res = await fetch("/api/medflow/job-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job!.id, action, actorName: "Dana Whitfield" }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(`${job!.jobNumber} → ${label}`);
      onAdvanced();
      onClose();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-[12px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const pctVal = Math.max(0, Math.min(1, value));
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pctVal);
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#e2eee9" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke="#1ABC9C" strokeWidth="6"
        strokeDasharray={c} strokeDashoffset={off}
        strokeLinecap="round" transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" className="fill-foreground text-[11px] font-bold">
        {Math.round(pctVal * 100)}%
      </text>
    </svg>
  );
}

function StructuredDoc({ job }: { job: JobWithRelations }) {
  let parsed: Record<string, string> | null = null;
  try {
    if (job.structuredDocJson) parsed = JSON.parse(job.structuredDocJson);
  } catch { /* ignore */ }
  const entities = parsed?.["entities"];
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          {parsed ? (
            <div className="prose prose-sm max-w-none">
              {Object.entries(parsed).filter(([k]) => k !== "entities").map(([k, v]) => (
                <div key={k} className="mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">{k}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-foreground">{v}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No structured document yet — run the Structuring Agent.</p>
          )}
        </CardContent>
      </Card>
      {entities && (
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Extracted entities</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Array.isArray(entities) ? entities : []).map((e: unknown, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {typeof e === "string" ? e : JSON.stringify(e)}
                </Badge>
              ))}
              {!Array.isArray(entities) && typeof entities === "object" && entities && (
                Object.entries(entities as Record<string, unknown>).map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-[10px]">
                    <span className="font-semibold text-secondary">{k}:</span> {String(v)}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QaFindings({ job }: { job: JobWithRelations }) {
  const review = job.qualityReviews?.[0];
  let findings: Array<{ type?: string; severity?: string; detail?: string; suggestion?: string }> = [];
  try {
    findings = review ? JSON.parse(review.findingsJson) : [];
  } catch { /* ignore */ }
  const sevStyle = (sev: string) => RISK_SEVERITY_STYLES[sev as keyof typeof RISK_SEVERITY_STYLES] ?? RISK_SEVERITY_STYLES.informational;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetaTile label="Quality score" value={review?.qualityScore?.toString() ?? "—"} />
        <MetaTile label="Risk score" value={review?.riskScore?.toString() ?? "—"} />
        <MetaTile label="Risk severity" value={review?.riskSeverity ?? "—"} />
        <MetaTile label="Recommendation" value={review?.recommendedAction ?? "—"} />
      </div>
      {findings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
          No QA findings — run the QA Agent to inspect.
        </div>
      ) : (
        <ul className="space-y-2">
          {findings.map((f, i) => {
            const s = sevStyle(f.severity ?? "informational");
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    <span className="text-[12px] font-semibold text-foreground">{f.type ?? "Finding"}</span>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>{s.label}</span>
                </div>
                {f.detail && <p className="mt-1 text-[12px] text-muted-foreground">{f.detail}</p>}
                {f.suggestion && (
                  <p className="mt-1 text-[11px] italic text-foreground/70">
                    <span className="font-semibold">Suggestion:</span> {f.suggestion}
                  </p>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Timeline({ job }: { job: JobWithRelations }) {
  const events = job.events ?? [];
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        <Activity className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        No timeline events yet.
      </div>
    );
  }
  return (
    <ol className="relative space-y-3 pl-5">
      <span className="absolute left-1.5 top-2 h-[calc(100%-1rem)] w-px bg-border" />
      {events.map((e, i) => {
        const initials = (e.actorName ?? "S").split(" ").map(s => s[0]).slice(0, 2).join("");
        return (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="relative"
          >
            <span className="absolute -left-[14px] top-1.5 h-3 w-3 rounded-full border-2 border-card bg-secondary" />
            <div className="flex items-start gap-2">
              <Avatar className="h-6 w-6 border border-border">
                <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-foreground">
                  <span className="font-semibold">{e.actorName ?? "System"}</span>
                  <span className="text-muted-foreground"> · {e.event}</span>
                </p>
                {e.detail && <p className="text-[11px] text-muted-foreground">{e.detail}</p>}
                <p className="text-[10px] text-muted-foreground/80">
                  {formatRelative(e.createdAt)} · {e.fromStatus ?? "∅"} → {e.toStatus ?? "∅"}
                </p>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
