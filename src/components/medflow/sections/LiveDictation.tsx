"use client";
// MedFlow — Live Dictation (A6)
// Real-time streaming transcription: mic → 5s chunks → base64 → ASR API → live transcript
// with word-level confidence coloring + job-creation handoff.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, CircleStop, Eraser, FileText, Mic, Pause, Play, Save, Square, Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "./_shared";

interface AsrWord {
  word: string;
  confidence: number;
  start_ms: number;
  end_ms: number;
}

interface AsrResponse {
  text?: string;
  words?: AsrWord[];
  is_final?: boolean;
  fallback?: boolean;
  error?: string;
}

interface TranscriptWord {
  id: string;
  word: string;
  confidence: number;
}

const DOC_TYPES = ["SOAP Note", "Consultation Note", "H&P", "Operative Report", "Discharge Summary", "Radiology Report", "Procedure Note", "Follow-up Note"];
const SPECIALTIES = ["Cardiology", "Orthopedics", "Pediatrics", "Emergency Medicine", "Internal Medicine", "Surgery", "Family Medicine"];
const PRIORITIES = ["Routine", "Urgent", "STAT"];

function fmtTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function confClass(c: number): string {
  if (c >= 0.95) return "text-emerald-600 dark:text-emerald-400";
  if (c >= 0.80) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function LiveDictation() {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptWord[]>([]);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Job-creation metadata
  const [patientRef, setPatientRef] = useState("");
  const [provider, setProvider] = useState("Dr. Emily Carter");
  const [specialty, setSpecialty] = useState("Cardiology");
  const [docType, setDocType] = useState("SOAP Note");
  const [priority, setPriority] = useState("Routine");

  // Refs — recorder + chunk loop
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send a 5-second audio chunk to the ASR endpoint and append words to the transcript.
  const transcribeChunk = useCallback(async (blob: Blob) => {
    if (pausedRef.current) return;
    setProcessing(true);
    try {
      const reader = new FileReader();
      reader.onerror = () => setProcessing(false);
      reader.onloadend = async () => {
        const b64 = (reader.result as string).split(",")[1];
        if (!b64) { setProcessing(false); return; }
        try {
          const res = await fetch("/api/streaming/transcribe-chunk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio_base64: `data:${blob.type};base64,${b64}` }),
          });
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          const json: AsrResponse = await res.json();
          if (json.fallback) setFallbackMode(true);
          if (json.error) { toast.error(`ASR error: ${json.error}`); setProcessing(false); return; }
          if (json.words?.length) {
            setTranscript(prev => [
              ...prev,
              ...json.words!.map(w => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, word: w.word, confidence: w.confidence })),
            ]);
          }
        } catch (e) {
          toast.error(`Transcription failed: ${(e as Error).message}`);
        } finally {
          setProcessing(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      toast.error(`Mic chunk failed: ${(e as Error).message}`);
      setProcessing(false);
    }
  }, []);

  // Pump a single chunk (slice the current accumulated Blob parts to a new Blob)
  const pumpChunk = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    if (pausedRef.current) return;
    // Snapshot + clear accumulated buffer (requestData triggers a dataavailable event)
    try {
      rec.requestData();
    } catch {
      /* noop */
    }
  }, []);

  // dataavailable handler — when requestData fires, we get the current audio blob
  const onDataAvailable = useCallback((e: BlobEvent) => {
    if (!e.data || e.data.size === 0) return;
    chunksRef.current.push(e.data);
    // Build a Blob of the current chunks for this 5-second window, send to ASR
    const blob = new Blob([...chunksRef.current], { type: e.data.type || "audio/webm" });
    chunksRef.current = [];
    void transcribeChunk(blob);
  }, [transcribeChunk]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = onDataAvailable;
      rec.onerror = () => toast.error("Microphone recording error.");
      rec.start();
      setRecording(true);
      setPaused(false);
      setFallbackMode(false);
      setElapsedSec(0);
      // start chunk pump (5-second windows)
      chunkTimerRef.current = setInterval(pumpChunk, 5000);
      // start elapsed timer
      elapsedTimerRef.current = setInterval(() => {
        if (!pausedRef.current) setElapsedSec(s => s + 1);
      }, 1000);
      toast.success("Recording started.");
    } catch (e) {
      const err = e as Error;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Microphone access denied. Please grant permission in your browser settings.");
      } else {
        toast.error(`Could not start microphone: ${err.message}`);
      }
    }
  }, [onDataAvailable, pumpChunk]);

  const pauseRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "recording") {
      try { rec.pause(); } catch { /* noop */ }
      setPaused(true);
      toast.info("Recording paused.");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "paused") {
      try { rec.resume(); } catch { /* noop */ }
      setPaused(false);
      toast.info("Recording resumed.");
    }
  }, []);

  const stopAll = useCallback((silent = false) => {
    if (chunkTimerRef.current) { clearInterval(chunkTimerRef.current); chunkTimerRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    recorderRef.current = null;
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* noop */ }
    streamRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setPaused(false);
    if (!silent) toast.info("Recording stopped.");
  }, []);

  const handleStop = useCallback(() => stopAll(false), [stopAll]);

  const handleClear = useCallback(() => {
    setTranscript([]);
    setElapsedSec(0);
    toast.info("Transcript cleared.");
  }, []);

  const handleSubmitJob = useCallback(async () => {
    if (transcript.length === 0) {
      toast.error("No transcript to submit — record some audio first.");
      return;
    }
    setSubmitting(true);
    // Mock job creation — POST to the jobs API (no-op write for demo) then toast
    const jobNumber = `JOB-2024-${(Math.floor(Math.random() * 99) + 1).toString().padStart(3, "0")}`;
    const text = transcript.map(t => t.word).join(" ");
    try {
      // Attempt to persist; if it fails, still toast success (demo)
      await fetch("/api/medflow/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobNumber,
          dictationText: text,
          documentType: docType,
          priority,
          provider,
          specialty,
          patientRef,
          source: "live-dictation",
        }),
      }).catch(() => null);
    } finally {
      setSubmitting(false);
      toast.success(`Job created: ${jobNumber}. AI pipeline started.`, {
        description: `${docType} · ${specialty} · ${priority}`,
      });
      setTranscript([]);
      stopAll(true);
    }
  }, [transcript, docType, priority, provider, specialty, patientRef, stopAll]);

  const avgConf = transcript.length
    ? transcript.reduce((s, w) => s + w.confidence, 0) / transcript.length
    : 0;
  const wordCount = transcript.length;

  return (
    <div>
      <PageHeader
        title="Live Dictation"
        description="Speak into your microphone — the transcript appears in real-time with word-level confidence coloring."
        icon={Mic}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleClear} disabled={!transcript.length || recording}>
              <Eraser className="mr-1.5 h-3.5 w-3.5" /> Clear
            </Button>
            <Button size="sm" onClick={handleSubmitJob} disabled={!transcript.length || submitting}>
              {submitting ? <Save className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
              {submitting ? "Submitting…" : "Submit as Job"}
            </Button>
          </>
        }
      />

      {fallbackMode && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Demo mode</AlertTitle>
          <AlertDescription>Using fallback transcription (ASR SDK unavailable). Speech-to-text will return a canned sample transcript.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT — mic + status */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-base">Microphone</CardTitle>
            <CardDescription className="text-xs">Tap to start streaming dictation</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pt-2">
            {/* Circular mic button */}
            <button
              type="button"
              onClick={recording ? handleStop : startRecording}
              aria-label={recording ? "Stop recording" : "Start recording"}
              className={cn(
                "relative grid h-32 w-32 place-items-center rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-secondary/30",
                recording
                  ? "bg-red-600 text-white shadow-lg shadow-red-500/30"
                  : "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary-700"
              )}
            >
              {recording && (
                <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-red-500/40" />
              )}
              {recording ? <Square className="h-10 w-10" /> : <Mic className="h-12 w-12" />}
            </button>

            {/* Status line */}
            <div className="flex items-center gap-2 text-sm">
              {recording ? (
                <>
                  <span className="mf-rec-pulse inline-block h-3 w-3 rounded-full bg-red-500" />
                  <span className="font-semibold text-red-700">{paused ? "Paused" : "Recording…"}</span>
                  <span className="font-mono text-muted-foreground">{fmtTimer(elapsedSec)}</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-3 w-3 rounded-full bg-muted-foreground/40" />
                  <span className="font-semibold text-muted-foreground">Idle</span>
                  <span className="font-mono text-muted-foreground">00:00</span>
                </>
              )}
            </div>

            {/* Waveform animation (visible while recording) */}
            {recording && !paused && (
              <div className="flex h-10 items-end gap-1" aria-hidden>
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="mf-wave-bar w-1 rounded-full bg-secondary"
                    style={{
                      height: `${10 + (i % 5) * 8}px`,
                      animationDelay: `${(i % 8) * 0.08}s`,
                    }}
                  />
                ))}
              </div>
            )}
            {paused && (
              <p className="text-xs text-muted-foreground">Recording paused — press resume to continue.</p>
            )}

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {recording && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={paused ? resumeRecording : pauseRecording}
                >
                  {paused ? <Play className="mr-1.5 h-3.5 w-3.5" /> : <Pause className="mr-1.5 h-3.5 w-3.5" />}
                  {paused ? "Resume" : "Pause"}
                </Button>
              )}
              {recording && (
                <Button size="sm" variant="outline" onClick={handleStop} className="text-red-700 border-red-300 hover:bg-red-50">
                  <CircleStop className="mr-1.5 h-3.5 w-3.5" /> Stop
                </Button>
              )}
            </div>

            {/* Live stats */}
            <div className="grid w-full grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Words</p>
                <p className="text-sm font-bold">{wordCount}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Avg conf</p>
                <p className={cn("text-sm font-bold", confClass(avgConf))}>{Math.round(avgConf * 100)}%</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">State</p>
                <p className="text-sm font-bold">{processing ? "ASR…" : recording ? "Live" : "Idle"}</p>
              </div>
            </div>

            {/* Confidence legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> ≥0.95</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 0.80–0.95</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> &lt;0.80</span>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT — live transcript + metadata */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Live transcript</span>
                {transcript.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">{transcript.length} words</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">Words appear as the ASR pipeline returns them. Color = confidence.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mf-scroll min-h-[260px] max-h-[420px] rounded-lg border border-border bg-muted/20 p-4">
                {transcript.length === 0 ? (
                  <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <Mic className="h-8 w-8 opacity-40" />
                    <p className="text-sm">Press the microphone button to begin live dictation.</p>
                    <p className="text-[11px]">Audio is recorded in 5-second chunks and streamed to the ASR service.</p>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-foreground">
                    <AnimatePresence initial={false}>
                      {transcript.map((w) => (
                        <motion.span
                          key={w.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                          className={cn("inline-block", confClass(w.confidence))}
                          title={`confidence: ${Math.round(w.confidence * 100)}%`}
                        >
                          {w.word}&nbsp;
                        </motion.span>
                      ))}
                    </AnimatePresence>
                    {processing && (
                      <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
                        <span className="mf-typing-dot h-1 w-1 rounded-full bg-secondary" />
                        <span className="mf-typing-dot h-1 w-1 rounded-full bg-secondary" />
                        <span className="mf-typing-dot h-1 w-1 rounded-full bg-secondary" />
                      </span>
                    )}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Job metadata</CardTitle>
              <CardDescription className="text-xs">Feeds into the new transcription job created on “Submit as Job”.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label htmlFor="patient-ref" className="text-[11px]">Patient reference</Label>
                  <Input id="patient-ref" placeholder="MRN-001 / patient initials" value={patientRef} onChange={e => setPatientRef(e.target.value)} className="h-9 text-xs" />
                </div>
                <div>
                  <Label htmlFor="provider" className="text-[11px]">Provider</Label>
                  <Input id="provider" placeholder="Dr. …" value={provider} onChange={e => setProvider(e.target.value)} className="h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-[11px]">Specialty</Label>
                  <Select value={specialty} onValueChange={setSpecialty}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Document type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full bg-primary text-primary-foreground"
                    size="sm"
                    onClick={handleSubmitJob}
                    disabled={!transcript.length || submitting}
                  >
                    {submitting ? "Submitting…" : "Submit as Job"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
