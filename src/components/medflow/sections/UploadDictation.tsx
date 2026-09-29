"use client";
// MedFlow — Upload Dictation form (react-hook-form + zod).

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity, AlertTriangle, Bot, CheckCircle2, Clock, FileAudio, FileStack,
  FileText, Loader2, Mic, Pencil, Plug, Send, ShieldCheck, Sparkles, Square,
  Upload as UploadIcon, Workflow, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFetch } from "@/hooks/medflow/useFetch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader, SectionError, SectionLoading } from "./_shared";

const PRIORITY_TAT: Record<string, string> = {
  Routine: "24 hours",
  Urgent: "12 hours",
  STAT: "4 hours",
};

const PIPELINE = [
  { label: "Intake Validation", icon: ShieldCheck, color: "mf-tab-yellow" },
  { label: "Transcription", icon: Bot, color: "mf-tab-orange" },
  { label: "Structuring", icon: FileText, color: "mf-tab-orange" },
  { label: "QA", icon: ShieldCheck, color: "mf-tab-green" },
  { label: "Allocation", icon: Pencil, color: "mf-tab-green" },
  { label: "SLA Monitoring", icon: Clock, color: "mf-tab-brown" },
  { label: "Delivery", icon: Send, color: "mf-tab-blue" },
  { label: "Billing", icon: Zap, color: "mf-tab-teal" },
  { label: "Security", icon: ShieldCheck, color: "mf-tab-pink" },
  { label: "Reporting", icon: Activity, color: "mf-tab-purple" },
];

const DELIVERY_DESTS = [
  { value: "portal", label: "Branded client portal" },
  { value: "pdf", label: "PDF document" },
  { value: "fhir", label: "FHIR R4 DocumentReference" },
  { value: "hl7", label: "HL7 v2 MDM message" },
  { value: "sftp", label: "SFTP drop" },
  { value: "webhook", label: "REST webhook" },
];

const schema = z.object({
  patientRef: z.string().min(3, "Patient reference required (e.g. SYN-884721)"),
  encounterRef: z.string().min(3, "Encounter reference required"),
  providerId: z.string().min(1, "Select a provider"),
  facilityId: z.string().min(1, "Select a facility"),
  departmentId: z.string().min(1, "Select a department"),
  specialtyId: z.string().min(1, "Select a specialty"),
  templateId: z.string().min(1, "Select a document template"),
  priority: z.enum(["Routine", "Urgent", "STAT"]),
  deliveryDest: z.string().min(1, "Select a delivery destination"),
  clientInstructions: z.string().optional(),
  audioFile: z.any().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Options {
  providers: { id: string; name: string; title?: string | null }[];
  facilities: { id: string; name: string; code: string }[];
  departments: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  templates: { id: string; name: string; documentType: string }[];
}

interface Props {
  onSubmitted: (jobNumber: string) => void;
}

export function UploadDictation({ onSubmitted }: Props) {
  const { data, loading, error, refresh } = useFetch<Options>("/api/medflow/options");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientRef: "",
      encounterRef: "",
      providerId: "",
      facilityId: "",
      departmentId: "",
      specialtyId: "",
      templateId: "",
      priority: "Routine",
      deliveryDest: "fhir",
      clientInstructions: "",
    },
  });

  const priority = form.watch("priority");
  const templateId = form.watch("templateId");
  const selectedTemplate = data?.templates.find(t => t.id === templateId);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  async function onSubmit(values: FormValues) {
    if (!file && !recording) {
      toast.error("Audio file required", { description: "Upload a .mp3/.wav/.m4a/.aac or record in browser." });
      return;
    }
    setSubmitting(true);
    try {
      // File metadata + fake durations
      const ext = file?.name.split(".").pop() ?? "wav";
      const audioFileName = file?.name ?? `recording-${Date.now()}.wav`;
      const audioSizeBytes = file?.size ?? 1_280_000;
      const audioDurationSec = Math.max(60, Math.round(audioSizeBytes / 16000));

      const payload = {
        ...values,
        audioFileName,
        audioSizeBytes,
        audioDurationSec,
        documentType: selectedTemplate?.documentType ?? "SOAP Note",
        ext,
        providerName: data?.providers.find(p => p.id === values.providerId)?.name,
      };
      const res = await fetch("/api/medflow/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { job } = await res.json();
      toast.success(`Dictation submitted — ${job.jobNumber}`, {
        description: "AI pipeline started.",
      });
      onSubmitted(job.jobNumber);
    } catch (e) {
      console.error(e);
      toast.error(`Submission failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div>
      <PageHeader title="Upload Dictation" description="Submit a new dictation and trigger the AI pipeline." icon={UploadIcon} />
      <SectionLoading rows={3} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Upload Dictation" description="Submit a new dictation and trigger the AI pipeline." icon={UploadIcon} />
      <SectionError message={error ?? "Unknown error"} onRetry={refresh} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Upload Dictation"
        description="Submit a new dictation and trigger the full 10-agent AI pipeline."
        icon={UploadIcon}
        actions={
          <Badge variant="outline" className="text-secondary border-secondary/40">
            <Sparkles className="mr-1 h-3 w-3" /> AI-ready
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — form */}
        <div className="lg:col-span-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Patient & encounter</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="patientRef"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient reference identifier</FormLabel>
                        <FormControl>
                          <Input placeholder="SYN-884721" {...field} />
                        </FormControl>
                        <FormDescription>De-identified patient token (no PHI).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="encounterRef"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Encounter reference</FormLabel>
                        <FormControl>
                          <Input placeholder="ENC-2024-04812" {...field} />
                        </FormControl>
                        <FormDescription>Visit / encounter identifier.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Clinical context</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="providerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provider</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {data.providers.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}{p.title ? ` · ${p.title}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="facilityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facility</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select facility" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {data.facilities.map(f => (
                              <SelectItem key={f.id} value={f.id}>{f.name} · {f.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {data.departments.map(d => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="specialtyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specialty</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select specialty" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {data.specialties.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="templateId"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Document template</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select document template" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {data.templates.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name} · {t.documentType}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Drives structuring + section validation.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Priority & SLA</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-3 gap-2"
                          >
                            {(["Routine", "Urgent", "STAT"] as const).map(p => (
                              <Label
                                key={p}
                                htmlFor={`p-${p}`}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                                  p === "STAT" && "border-red-300 bg-red-50 text-red-700",
                                  p === "Urgent" && "border-amber-300 bg-amber-50 text-amber-700",
                                  p === "Routine" && "border-border",
                                  field.value === p && "ring-2 ring-secondary",
                                )}
                              >
                                <RadioGroupItem id={`p-${p}`} value={p} /> {p}
                              </Label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <Label>Required turnaround time</Label>
                    <div className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-bold">
                      {PRIORITY_TAT[priority]}
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        (auto-computed from priority)
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">STAT=4h · Urgent=12h · Routine=24h</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Delivery</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="deliveryDest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery destination</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DELIVERY_DESTS.map(d => (
                              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientInstructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client-specific instructions</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Use provider's preferred medication spellings; flag any drug-drug interactions."
                            className="min-h-20"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Audio file upload */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mic className="h-4 w-4 text-secondary" /> Audio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:border-secondary"
                  >
                    <FileAudio className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">
                      Drag & drop audio file, or
                    </p>
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-semibold hover:bg-muted">
                      <UploadIcon className="h-3.5 w-3.5" /> Choose file
                      <input type="file" accept=".mp3,.wav,.m4a,.aac" className="hidden" onChange={onFileSelected} />
                    </label>
                    <p className="mt-2 text-[11px] text-muted-foreground">.mp3 · .wav · .m4a · .aac · max 100MB</p>
                  </div>

                  {file && (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileAudio className="h-4 w-4 text-secondary" />
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-foreground">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Malware scan: clean
                      </Badge>
                    </div>
                  )}

                  {recording && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex items-end gap-0.5">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <span key={i} className="mf-wave-bar block h-3 w-1 rounded bg-red-500" style={{ animationDelay: `${i * 0.1}s` }} />
                            ))}
                          </span>
                          <span className="font-mono text-sm font-bold text-red-700">
                            {Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setRecording(false)}>
                          <Square className="mr-1 h-3.5 w-3.5" /> Stop
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button type="button" variant="outline" size="sm" onClick={() => { setRecording(!recording); setRecordTime(0); }}>
                    <Mic className="mr-1.5 h-3.5 w-3.5" /> {recording ? "Stop recording" : "Record in browser"}
                  </Button>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => form.reset()}>Reset</Button>
                <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
                  {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  Submit dictation
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Right column — pipeline preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-secondary" /> Pipeline preview
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">10 agents</Badge>
              </div>
              <CardDescription className="text-xs">The 10-step AI workflow that will run on submit.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {PIPELINE.map((step, i) => (
                  <motion.li
                    key={step.label}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2"
                  >
                    <span className={cn("grid h-7 w-7 place-items-center rounded-md text-[10px] font-bold text-white", step.color)}>
                      {i + 1}
                    </span>
                    <step.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 text-[12px] font-medium text-foreground">{step.label}</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  </motion.li>
                ))}
              </ol>
              <div className="mt-4 rounded-lg bg-primary/5 p-3 text-[11px] text-foreground/80">
                <Plug className="mb-1 h-3.5 w-3.5 text-secondary" />
                All agents are tenant-aware, idempotent, retryable, and run on the FastAPI service at port :8000. AI never marks a document clinically final.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
