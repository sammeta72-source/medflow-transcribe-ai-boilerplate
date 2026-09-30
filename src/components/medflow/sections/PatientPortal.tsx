"use client";
// MedFlow — Patient Portal (F1)
// Patient-facing portal mockup: documents, consent, secure messaging, DSR history, FHIR $everything export.
// Uses /api/medflow/patient-portal.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, BadgeCheck, Download, FileText, Inbox, Mail, MessageSquareReply,
  RefreshCw, Send, ShieldCheck, Trash2, UserCircle2, FileDown, Lock, Stethoscope, Database,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatDateTime } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

interface PatientDoc {
  jobNumber: string;
  date: string;
  provider: string;
  facility: string;
  specialty: string;
  docType: string;
  status: string;
  deliveryMethod: string;
  downloadUrl: string;
}
interface Consent {
  id: string;
  purpose: string;
  granted: boolean;
  date: string | null;
  withdrawable: boolean;
}
interface PatientMessage {
  id: string;
  from: string;
  date: string;
  subject: string;
  unread: boolean;
}
interface DsrEntry {
  id: string;
  type: string;
  date: string;
  status: string;
  sla: string;
}
interface PatientData {
  patient: { name: string; mrn: string; dob: string; language: string };
  documents: PatientDoc[];
  consents: Consent[];
  messages: PatientMessage[];
  dsr_history: DsrEntry[];
  fhir_export_url: string;
}

function statusBadge(status: string): string {
  if (status === "Delivered" || status === "completed") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (status === "pending") return "bg-amber-100 text-amber-700 border-amber-300";
  if (status === "rejected" || status === "failed") return "bg-red-100 text-red-700 border-red-300";
  return "bg-muted text-muted-foreground";
}

function dsrLabel(type: string): string {
  return {
    access: "Request Access",
    portability: "Request Portability (FHIR)",
    rectification: "Request Rectification",
    erasure: "Request Erasure",
  }[type] ?? type;
}

const DSR_TYPES = ["access", "portability", "rectification", "erasure"];

export function PatientPortal() {
  const { data, loading, error, refresh } = useFetch<PatientData>("/api/medflow/patient-portal");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [dsrSubmitting, setDsrSubmitting] = useState<string | null>(null);

  if (loading && !data) return (
    <div>
      <PageHeader title="Patient Portal" description="HIPAA-compliant patient access to documents." icon={UserCircle2} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error && !data) return (
    <div>
      <PageHeader title="Patient Portal" description="HIPAA-compliant patient access to documents." icon={UserCircle2} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  const p = data!;

  const toggleConsent = (c: Consent, value: boolean) => {
    toast.success(`Consent updated for ${c.purpose}.`, { description: value ? "Granted" : "Revoked" });
  };
  const withdrawConsent = (c: Consent) => {
    toast.success(`Consent withdrawn for ${c.purpose}.`, { description: "All derived data will be reviewed." });
  };
  const sendReply = (m: PatientMessage) => {
    if (!replyText.trim()) { toast.error("Enter a reply."); return; }
    toast.success(`Secure message sent to ${m.from}.`);
    setReplyingTo(null);
    setReplyText("");
  };
  const submitDsr = (type: string) => {
    setDsrSubmitting(type);
    setTimeout(() => {
      setDsrSubmitting(null);
      toast.success(`DSR submitted: ${dsrLabel(type)}.`, { description: "SLA: 30 days." });
    }, 400);
  };
  const exportFhir = () => {
    toast.success(`Generating FHIR bundle for ${p.patient.name}…`, { description: "Check your email for the download link." });
  };

  return (
    <div>
      <PageHeader
        title="Patient Portal"
        description="HIPAA-compliant patient access to documents, consent management, secure messaging, and data-subject rights."
        icon={UserCircle2}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={exportFhir}>
              <Database className="mr-1.5 h-3.5 w-3.5" /> FHIR $everything Export
            </Button>
          </>
        }
      />

      {/* Patient banner */}
      <Card className="mb-4">
        <CardContent className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center">
          <Avatar className="h-12 w-12 border border-border">
            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
              {p.patient.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-foreground">{p.patient.name}</p>
              <Badge variant="outline" className="text-[10px] text-secondary border-secondary/40">Synthetic identity</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>MRN: <span className="font-mono font-semibold text-foreground">{p.patient.mrn}</span></span>
              <span>DOB: <span className="font-semibold text-foreground">{p.patient.dob}</span></span>
              <span>Language: <span className="font-semibold text-foreground">{p.patient.language}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-secondary" />
            <span>Encrypted at rest + in transit</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="documents">
        <TabsList className="mb-4">
          <TabsTrigger value="documents"><FileText className="mr-1.5 h-3.5 w-3.5" /> Documents</TabsTrigger>
          <TabsTrigger value="consent"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Consent</TabsTrigger>
          <TabsTrigger value="messages"><Mail className="mr-1.5 h-3.5 w-3.5" /> Messages</TabsTrigger>
          <TabsTrigger value="rights"><Database className="mr-1.5 h-3.5 w-3.5" /> Data Rights</TabsTrigger>
        </TabsList>

        {/* ── Documents ──────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivered Documents</CardTitle>
              <CardDescription className="text-xs">Documents delivered to this patient via FHIR / portal / SFTP</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {p.documents.length === 0 ? (
                <EmptyState icon={FileText} message="No documents delivered yet." />
              ) : (
                <div className="mf-scroll-lg overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px]">Job</TableHead>
                        <TableHead className="text-[11px]">Date</TableHead>
                        <TableHead className="text-[11px]">Provider</TableHead>
                        <TableHead className="text-[11px]">Facility</TableHead>
                        <TableHead className="text-[11px]">Specialty</TableHead>
                        <TableHead className="text-[11px]">Type</TableHead>
                        <TableHead className="text-[11px]">Status</TableHead>
                        <TableHead className="text-[11px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.documents.map((d, i) => (
                        <motion.tr
                          key={d.jobNumber}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15, delay: i * 0.03 }}
                          className="hover:bg-muted/40"
                        >
                          <TableCell className="font-mono text-[11px] font-semibold">{d.jobNumber}</TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">{formatDateTime(d.date)}</TableCell>
                          <TableCell className="text-[11px]">{d.provider ?? "—"}</TableCell>
                          <TableCell className="text-[11px]">{d.facility ?? "—"}</TableCell>
                          <TableCell className="text-[11px]">{d.specialty ?? "—"}</TableCell>
                          <TableCell className="text-[11px]">{d.docType}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px]", statusBadge(d.status))}>{d.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => toast.info(`Viewing ${d.docType} (${d.jobNumber})`)}>
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => toast.info(`Downloading ${d.docType} as PDF…`)}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Consent ───────────────────────────────────────────────── */}
        <TabsContent value="consent">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Consent Management</CardTitle>
              <CardDescription className="text-xs">Grant or revoke consent for treatment, research, and marketing use of PHI</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {p.consents.length === 0 ? (
                <EmptyState icon={ShieldCheck} message="No consent records." />
              ) : (
                <div className="mf-scroll max-h-[60vh] overflow-y-auto p-2">
                  <AnimatePresence>
                    {p.consents.map((c, i) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, delay: i * 0.04 }}
                        className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className={cn("grid h-9 w-9 place-items-center rounded-full", c.granted ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                            {c.granted ? <BadgeCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{c.purpose}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {c.granted ? `Granted on ${c.date ?? "—"}` : "Not granted"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {c.granted && c.withdrawable && (
                            <Button size="sm" variant="outline" className="h-8 text-red-700 border-red-300 hover:bg-red-50" onClick={() => withdrawConsent(c)}>
                              Withdraw
                            </Button>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{c.granted ? "Granted" : "Revoked"}</span>
                            <Switch
                              checked={c.granted}
                              onCheckedChange={(v) => toggleConsent(c, v)}
                              aria-label={`Toggle consent for ${c.purpose}`}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Messages ──────────────────────────────────────────────── */}
        <TabsContent value="messages">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Secure Messages</CardTitle>
              <CardDescription className="text-xs">HIPAA-compliant direct messaging between patient and providers</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {p.messages.length === 0 ? (
                <EmptyState icon={Mail} message="No messages." />
              ) : (
                <div className="mf-scroll max-h-[60vh] overflow-y-auto p-2">
                  <AnimatePresence>
                    {p.messages.map((m, i) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, delay: i * 0.04 }}
                        className="mb-2 rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary/15 text-secondary">
                              <Mail className="h-4 w-4" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">{m.from}</p>
                                {m.unread && <Badge className="text-[9px] bg-secondary text-secondary-foreground">Unread</Badge>}
                              </div>
                              <p className="text-[12px] text-foreground">{m.subject}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDateTime(m.date)}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setReplyingTo(replyingTo === m.id ? null : m.id)}>
                            <MessageSquareReply className="mr-1 h-3 w-3" /> Reply
                          </Button>
                        </div>
                        {replyingTo === m.id && (
                          <div className="mt-3 space-y-2 border-t border-border pt-3">
                            <Textarea
                              rows={3}
                              placeholder={`Reply to ${m.from}…`}
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              className="text-xs"
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(null); setReplyText(""); }}>Cancel</Button>
                              <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => sendReply(m)}>
                                <Send className="mr-1 h-3 w-3" /> Send
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Data Rights ───────────────────────────────────────────── */}
        <TabsContent value="rights">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* DSR buttons */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-secondary" /> Data Subject Rights
                </CardTitle>
                <CardDescription className="text-xs">Submit GDPR/HIPAA data-subject requests. SLA: 30 days.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DSR_TYPES.map(t => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    className="h-auto justify-start py-2 text-left"
                    disabled={dsrSubmitting === t}
                    onClick={() => submitDsr(t)}
                  >
                    {dsrSubmitting === t
                      ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      : <Inbox className="mr-1.5 h-3.5 w-3.5" />}
                    {dsrLabel(t)}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* DSR history */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">DSR History</CardTitle>
                <CardDescription className="text-xs">Past requests + SLA status</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {p.dsr_history.length === 0 ? (
                  <EmptyState icon={Inbox} message="No DSR history yet." />
                ) : (
                  <div className="mf-scroll-lg overflow-auto max-h-[40vh]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Type</TableHead>
                          <TableHead className="text-[11px]">Date</TableHead>
                          <TableHead className="text-[11px]">Status</TableHead>
                          <TableHead className="text-[11px]">SLA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.dsr_history.map(d => (
                          <TableRow key={d.id} className="hover:bg-muted/40">
                            <TableCell className="text-[11px] capitalize font-semibold">{d.type}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{formatDateTime(d.date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[10px] capitalize", statusBadge(d.status))}>{d.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[10px]", d.sla === "met" ? "text-emerald-700 border-emerald-300 bg-emerald-50" : "text-amber-700 border-amber-300 bg-amber-50")}>
                                {d.sla === "met" ? "SLA met" : "SLA pending"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* FHIR export CTA */}
          <Alert className="mt-4 border-secondary/40 bg-secondary/5 text-foreground">
            <Database className="h-4 w-4 text-secondary" />
            <AlertTitle>FHIR $everything Export</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Generate a complete FHIR bundle (Patient + every related resource) for portability or personal health record use.</span>
              <Button size="sm" className="bg-primary text-primary-foreground" onClick={exportFhir}>
                <FileDown className="mr-1.5 h-3.5 w-3.5" /> Generate FHIR Bundle
              </Button>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
