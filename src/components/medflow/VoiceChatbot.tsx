"use client";
// MedFlow AI Operations Copilot — floating voice-enabled chatbot widget.
// (Task 7 — additive overlay, mounted once alongside <AppShell /> in page.tsx.)
//
// Self-contained client state — no Zustand. Uses:
//   - /api/chat            (LLM completions, server-side z-ai-web-dev-sdk)
//   - /api/chat/asr        (speech-to-text from a MediaRecorder blob)
//   - /api/chat/tts        (text-to-speech as audio/mpeg binary)
//   - /api/chat/agent      (FastAI agent run proxy on :8000, with fallback mock)
//
// Position: fixed bottom-20 right-4 z-50 — floats above the sticky footer
// (~40px tall) and the demo-user switcher (also bottom-4 right-4).
// Mobile: panel shrinks to w-[calc(100vw-2rem)], desktop: w-96.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bot,
  Mic,
  SendHorizontal,
  Volume2,
  X,
  Trash2,
  Square,
  Sparkles,
  Radio,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────
type Role = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  // optional — set when the message triggered an agent run
  agentRun?: {
    agentId: string;
    jobId: string;
    summary: string;
  };
}

// ── Shape returned by /api/chat/agent (mirrors the FastAPI run record) ────
interface AgentRunResult {
  agent_id?: string;
  job_id?: string;
  tenant_id?: string;
  correlation_id?: string;
  status?: string;
  started_at?: string;
  completed_at?: string | null;
  duration_ms?: number;
  cost_usd?: number;
  model?: string;
  prompt_version?: string;
  output?: Record<string, unknown> | null;
  // synthetic-fallback flags
  synthetic?: boolean;
  upstream_status?: number;
  fallback_reason?: string;
}

// ── Known agent ids (must mirror /api/chat/agent route) ──────────────────
const KNOWN_AGENT_IDS = [
  "intake-validation",
  "transcription",
  "structuring",
  "qa",
  "allocation",
  "sla",
  "delivery",
  "billing",
  "security",
  "reporting",
] as const;
type KnownAgentId = (typeof KNOWN_AGENT_IDS)[number];

const AGENT_LABELS: Record<string, string> = {
  "intake-validation": "Intake Validation",
  transcription: "Transcription",
  structuring: "Structuring",
  qa: "QA",
  allocation: "Allocation",
  sla: "SLA",
  delivery: "Delivery",
  billing: "Billing",
  security: "Security",
  reporting: "Reporting",
};

// ── Quick-action chips ───────────────────────────────────────────────────
// `agentId` set → chip directly triggers the agent run (skips chat).
// `agentId` not set → chip sends the label as a user message.
interface Chip {
  label: string;
  agentId?: KnownAgentId;
  jobId?: string;
}

const QUICK_CHIPS: Chip[] = [
  { label: "Run Transcription Agent", agentId: "transcription", jobId: "JOB-2024-001" },
  { label: "Run QA Agent", agentId: "qa", jobId: "JOB-2024-001" },
  { label: "Check SLA risk", agentId: "sla", jobId: "JOB-2024-001" },
  { label: "Summarize today's backlog" },
  { label: "Route a STAT job", agentId: "allocation", jobId: "JOB-2024-001" },
  { label: "Run Delivery Agent", agentId: "delivery", jobId: "JOB-2024-001" },
  { label: "Run Intake Validation", agentId: "intake-validation", jobId: "JOB-2024-001" },
];

// ── Agent-intent detector ────────────────────────────────────────────────
// Scans user text for known agent names + JOB-XXXX patterns.
export function detectAgentIntent(text: string): { agentId?: string; jobId?: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Direct agent-id hit ("run transcription", "trigger qa", etc.).
  let agentId: string | undefined;
  for (const id of KNOWN_AGENT_IDS) {
    // Match the id literally ("intake-validation") OR the short label
    // ("transcription", "qa", "allocation", "sla", "delivery", "billing",
    // "security", "reporting", "intake", "structuring"). Also handle "run ...
    // agent" / "trigger ...".
    const label = AGENT_LABELS[id].toLowerCase();
    const tokens = [id, label, label.split(" ")[0]];
    if (tokens.some((t) => t && lower.includes(t))) {
      agentId = id;
      break;
    }
  }

  // Phrase fallback: "run ... agent" / "trigger ..."
  if (!agentId) {
    if (/\b(run|trigger|execute|invoke|kick off|start)\b.*\bagent\b/.test(lower)) {
      // best-effort label match inside the phrase
      for (const id of KNOWN_AGENT_IDS) {
        const label = AGENT_LABELS[id].toLowerCase();
        if (label && lower.includes(label)) {
          agentId = id;
          break;
        }
      }
    }
  }

  // Job id (JOB-XXXX-NNNN) — anywhere in the text.
  const jobMatch = text.match(/\bJOB-\d{4}-\d{3,4}\b/i);
  const jobId = jobMatch ? jobMatch[0].toUpperCase() : undefined;

  if (!agentId && !jobId) return null;
  return { agentId, jobId };
}

// ── Client-side agent-run summarizer ─────────────────────────────────────
// Mirrors the server-side helper in /api/chat/agent/route.ts.
// Returns a short human summary from the FastAPI run output.
export function summarizeRunClient(
  agentId: string,
  run: {
    status?: string;
    duration_ms?: number;
    cost_usd?: number;
    output?: Record<string, unknown> | null;
  },
): string {
  const o = (run.output ?? {}) as Record<string, unknown>;
  const status = run.status ?? "succeeded";
  const dur = typeof run.duration_ms === "number" ? `${run.duration_ms}ms` : "";
  const cost = typeof run.cost_usd === "number" ? `$${run.cost_usd.toFixed(4)}` : "";

  if (status !== "succeeded") {
    return [`${agentId} ${status}`, dur, cost].filter(Boolean).join(", ");
  }

  switch (agentId as KnownAgentId) {
    case "transcription": {
      const conf =
        typeof o.confidence === "number"
          ? `confidence ${(o.confidence * 100).toFixed(0)}%`
          : "transcript ready";
      return [conf, dur, cost].filter(Boolean).join(", ");
    }
    case "qa": {
      const qs = typeof o.quality_score === "number" ? `QA score ${o.quality_score}/100` : "";
      const risk =
        (typeof o.risk_severity === "string" && `risk ${o.risk_severity}`) ||
        (typeof o.severity === "string" && `risk ${o.severity}`) ||
        "";
      const fc = Array.isArray(o.findings) ? `${o.findings.length} findings` : "";
      return [qs, risk, fc, dur, cost].filter(Boolean).join(", ");
    }
    case "structuring": {
      const t = typeof o.template === "string" ? o.template : "structured note";
      const sec = Array.isArray(o.sections) ? `${o.sections.length} sections` : "";
      return [`structured as ${t}`, sec, dur, cost].filter(Boolean).join(", ");
    }
    case "allocation": {
      const name =
        (typeof o.assigned_user_name === "string" && o.assigned_user_name) ||
        (typeof o.assigned_to === "string" && o.assigned_to) ||
        "a worker";
      return [`routed to ${name}`, dur, cost].filter(Boolean).join(", ");
    }
    case "sla": {
      const atRisk = Array.isArray(o.jobs_at_risk) ? `${o.jobs_at_risk.length} jobs at risk` : "";
      const esc =
        typeof o.escalation_triggered === "number"
          ? `${o.escalation_triggered} escalations`
          : "";
      return [atRisk, esc, dur, cost].filter(Boolean).join(", ");
    }
    case "delivery": {
      const channel =
        (typeof o.channel === "string" && o.channel) ||
        (typeof o.method === "string" && o.method) ||
        "channel";
      const code = typeof o.response_code === "number" ? `HTTP ${o.response_code}` : "";
      return [`delivered via ${channel}`, code, dur, cost].filter(Boolean).join(", ");
    }
    case "billing": {
      const amt = typeof o.amount_usd === "number" ? `$${o.amount_usd.toFixed(2)}` : "";
      const inv = typeof o.invoice_id === "string" ? o.invoice_id : "";
      return [`billed ${amt}`, inv, dur, cost].filter(Boolean).join(", ");
    }
    case "security": {
      const threats =
        typeof o.threats_blocked === "number" ? `${o.threats_blocked} blocked` : "clean";
      return [`security scan: ${threats}`, dur, cost].filter(Boolean).join(", ");
    }
    case "reporting": {
      const rows = typeof o.rows_emitted === "number" ? `${o.rows_emitted} rows` : "report";
      return [`report generated (${rows})`, dur, cost].filter(Boolean).join(", ");
    }
    case "intake-validation": {
      const valid = o.valid === true ? "valid" : "invalid";
      const meta =
        typeof o.metadata_completeness === "number"
          ? `metadata ${(o.metadata_completeness * 100).toFixed(0)}%`
          : "";
      const mal = typeof o.malware_scan === "string" ? `malware=${o.malware_scan}` : "";
      return [`intake ${valid}`, meta, mal, dur, cost].filter(Boolean).join(", ");
    }
    default: {
      const snip = JSON.stringify(o).slice(0, 80);
      return [snip, dur, cost].filter(Boolean).join(", ");
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────
function uid(prefix = "m"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Convert a Blob to a base64 data URI (used for the ASR payload).
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// ── Default welcome message ──────────────────────────────────────────────
const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I'm the MedFlow AI Operations Copilot. Ask me to run an agent, summarize job status, or check SLA risk. Try a quick action below, or hold the mic to speak.",
};

// ── Main component ───────────────────────────────────────────────────────
export function VoiceChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voice, setVoice] = useState("tongtong");

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecSeconds(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  // Cleanup mic/stream on unmount
  useEffect(() => {
    return () => {
      stopMicStream();
    };
  }, []);

  function stopMicStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      mediaRecorderRef.current = null;
    }
  }

  // ── TTS playback ──────────────────────────────────────────────────────
  const speak = useCallback(
    async (text: string) => {
      if (!text || isPlaying) return;
      try {
        const res = await fetch("/api/chat/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `TTS HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.onended = () => {
            setIsPlaying(false);
            URL.revokeObjectURL(url);
          };
          audioRef.current.onerror = () => {
            setIsPlaying(false);
            URL.revokeObjectURL(url);
          };
          await audioRef.current.play().catch(() => {
            /* user gesture required on some browsers — swallow */
          });
          setIsPlaying(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`TTS failed: ${msg}`);
        setIsPlaying(false);
      }
    },
    [isPlaying, voice],
  );

  // ── Trigger a FastAPI agent run + append a system summary ──────────────
  const triggerAgent = useCallback(
    async (agentId: string, jobId?: string) => {
      try {
        const res = await fetch("/api/chat/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, jobId }),
        });
        if (!res.ok) {
          // Even on 500 we expect a JSON error envelope
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `agent HTTP ${res.status}`);
        }
        const run = (await res.json()) as AgentRunResult;
        const summary = summarizeRunClient(agentId, run);
        const finalJobId = run.job_id || jobId || "JOB-2024-001";
        const label = AGENT_LABELS[agentId] ?? agentId;
        const ok = run.status === "succeeded";
        const msg: ChatMessage = {
          id: uid("agent"),
          role: "system",
          content: `${ok ? "✅" : "⚠️"} ${label} Agent ran on ${finalJobId} — ${summary}`,
          agentRun: { agentId, jobId: finalJobId, summary },
        };
        setMessages((prev) => [...prev, msg]);
        return msg;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((prev) => [
          ...prev,
          { id: uid("err"), role: "system", content: `⚠️ Agent run failed: ${msg}` },
        ]);
        toast.error(`Agent run failed: ${msg}`);
        return null;
      }
    },
    [],
  );

  // ── Send a chat message (optionally also trigger an agent in parallel) ─
  const sendMessage = useCallback(
    async (text: string, options?: { skipAgent?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      const userMsg: ChatMessage = {
        id: uid("u"),
        role: "user",
        content: trimmed,
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput("");
      setIsThinking(true);

      // Detect agent intent → trigger in parallel (but keep the chat answer too).
      let intent: ReturnType<typeof detectAgentIntent> = null;
      if (!options?.skipAgent) {
        intent = detectAgentIntent(trimmed);
      }

      // Fire the agent run alongside the chat completion.
      const agentPromise = intent?.agentId
        ? triggerAgent(intent.agentId, intent.jobId)
        : Promise.resolve(null);

      // Chat completion with the full message history.
      const chatPromise = (async () => {
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
            }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `chat HTTP ${res.status}`);
          }
          const data = await res.json();
          const content: string | undefined = data?.content;
          if (!content) {
            throw new Error(data?.error || "Empty chat response");
          }
          return content as string;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setMessages((prev) => [
            ...prev,
            { id: uid("err"), role: "system", content: `⚠️ ${msg}` },
          ]);
          toast.error(`Copilot error: ${msg}`);
          return null;
        }
      })();

      const [assistantContent] = await Promise.all([chatPromise, agentPromise]);

      if (assistantContent) {
        const assistantMsg: ChatMessage = {
          id: uid("a"),
          role: "assistant",
          content: assistantContent,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (autoSpeak) {
          // Fire-and-forget TTS for the assistant reply.
          void speak(assistantContent);
        }
      }

      setIsThinking(false);
      // Re-focus the input for follow-up typing.
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [messages, isThinking, triggerAgent, autoSpeak, speak],
  );

  // ── Recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone API not supported in this browser");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick the best mime type the browser supports.
      const candidateTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mimeType =
        candidateTypes.find((t) =>
          typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported
            ? MediaRecorder.isTypeSupported(t)
            : false,
        ) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = handleRecordingStop;
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.success("Recording started — click stop to transcribe");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Microphone unavailable: ${msg}`);
      stopMicStream();
      setIsRecording(false);
    }
  }, []);

  async function handleRecordingStop() {
    const chunks = recordedChunksRef.current;
    if (!chunks.length) {
      toast.error("Empty recording — nothing to transcribe");
      return;
    }
    const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
    if (blob.size < 200) {
      toast.error("Recording too short — try again");
      return;
    }
    try {
      const dataUri = await blobToBase64(blob);
      const res = await fetch("/api/chat/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: dataUri }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `ASR HTTP ${res.status}`);
      }
      const data = await res.json();
      const text: string = (data?.text ?? "").trim();
      if (!text) {
        toast.error("No speech detected in recording");
        return;
      }
      toast.success("Transcribed — sending…");
      // Fill the textarea AND auto-send.
      setInput("");
      await sendMessage(text, { skipAgent: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Speech-to-text failed: ${msg}`);
      setMessages((prev) => [
        ...prev,
        { id: uid("err"), role: "system", content: `⚠️ ASR failed: ${msg}` },
      ]);
    }
  }

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // triggers onstop → handleRecordingStop
    }
    setIsRecording(false);
    // Stop the mic stream (tracks) — the onstop handler is async; the stream
    // is fully released in the cleanup effect on unmount.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // ── Keyboard: Enter to send, Shift+Enter for newline ─────────────────
  const onInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  // ── Quick-action chips ────────────────────────────────────────────────
  const onChipClick = (chip: Chip) => {
    if (chip.agentId) {
      void triggerAgent(chip.agentId, chip.jobId);
    } else {
      void sendMessage(chip.label);
    }
  };

  // ── Clear chat ────────────────────────────────────────────────────────
  const clearChat = () => {
    setMessages([WELCOME]);
    toast.success("Chat cleared");
  };

  // Memoised list of messages for render
  const renderedMessages = useMemo(() => messages, [messages]);

  return (
    <TooltipProvider>
      <div
        className="fixed bottom-20 right-4 z-50"
        role="region"
        aria-label="MedFlow AI Operations Copilot"
      >
        {/* Hidden audio element for TTS playback */}
        <audio ref={audioRef} className="hidden" aria-hidden="true" preload="none" />

        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="panel"
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={cn(
                "flex h-[min(70vh,560px)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:w-96",
              )}
              role="dialog"
              aria-modal="false"
              aria-label="MedFlow Copilot chat"
            >
              {/* ── Header ───────────────────────────────────────────── */}
              <header className="mf-gradient flex items-center justify-between gap-2 px-3 py-2.5 text-primary-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">
                      MedFlow Copilot
                    </p>
                    <p className="truncate text-[10px] text-white/75">
                      Voice + agent orchestration
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        ref={firstFocusableRef}
                        size="icon"
                        variant="ghost"
                        onClick={clearChat}
                        className="h-8 w-8 text-primary-foreground hover:bg-white/15"
                        aria-label="Clear chat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Clear chat</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setIsOpen(false)}
                        className="h-8 w-8 text-primary-foreground hover:bg-white/15"
                        aria-label="Close chat"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Close</TooltipContent>
                  </Tooltip>
                </div>
              </header>

              {/* ── Messages ────────────────────────────────────────── */}
              <div className="mf-scroll flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3">
                {renderedMessages.map((m) => {
                  if (m.role === "system") {
                    return (
                      <div
                        key={m.id}
                        className="mx-auto w-fit max-w-[90%] rounded-md bg-secondary/10 px-2.5 py-1 text-center text-[11px] italic leading-snug text-secondary"
                      >
                        {m.content}
                      </div>
                    );
                  }
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "group flex items-end gap-1.5",
                        isUser ? "justify-end" : "justify-start",
                      )}
                    >
                      {!isUser && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full mf-gradient">
                          <Sparkles className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "relative max-w-[80%] whitespace-pre-wrap break-words px-3 py-2 text-[13px] leading-snug shadow-sm",
                          isUser
                            ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-2xl rounded-bl-sm bg-muted text-foreground",
                        )}
                      >
                        {m.content}
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => void speak(m.content)}
                            aria-label="Speak this reply"
                            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary/20 hover:text-secondary group-hover:opacity-100"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isThinking && (
                  <div className="flex items-end gap-1.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full mf-gradient">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5 shadow-sm">
                      <span className="mf-typing-dot h-1.5 w-1.5 rounded-full bg-secondary" />
                      <span className="mf-typing-dot h-1.5 w-1.5 rounded-full bg-secondary" />
                      <span className="mf-typing-dot h-1.5 w-1.5 rounded-full bg-secondary" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Quick-action chips ──────────────────────────────── */}
              <div className="mf-scroll flex gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2">
                {QUICK_CHIPS.map((chip) => {
                  const isAgent = !!chip.agentId;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => onChipClick(chip)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        isAgent
                          ? "border-secondary/40 bg-secondary/10 text-secondary hover:bg-secondary/20"
                          : "border-border bg-background text-foreground hover:bg-muted",
                      )}
                      aria-label={chip.label}
                    >
                      {isAgent && <Sparkles className="h-3 w-3" />}
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* ── Input area ──────────────────────────────────────── */}
              <div className="border-t border-border bg-card p-3">
                {isRecording ? (
                  <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 dark:bg-red-950/30">
                    <span className="mf-rec-pulse h-3 w-3 shrink-0 rounded-full bg-red-500" />
                    <span className="flex-1 text-[12px] font-medium text-red-700 dark:text-red-300">
                      Recording {formatTimer(recSeconds)}…
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={stopRecording}
                      className="h-8 gap-1 px-2.5"
                      aria-label="Stop recording"
                    >
                      <Square className="h-3.5 w-3.5" /> Stop
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => void startRecording()}
                          className="h-10 w-10 shrink-0 rounded-full border-secondary/40 text-secondary hover:bg-secondary/10"
                          aria-label="Hold to speak"
                          disabled={isThinking}
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Click to record voice</TooltipContent>
                    </Tooltip>

                    <Textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onInputKeyDown}
                      placeholder="Ask the Copilot…  (Enter to send)"
                      rows={1}
                      className="mf-scroll min-h-10 max-h-24 resize-none bg-background px-3 py-2 text-[13px] leading-snug"
                      aria-label="Message the MedFlow Copilot"
                      disabled={isThinking}
                    />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => void sendMessage(input)}
                          disabled={!input.trim() || isThinking}
                          className="h-10 w-10 shrink-0 rounded-full mf-gradient text-primary-foreground hover:opacity-90"
                          aria-label="Send message"
                        >
                          <SendHorizontal className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Send</TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* Voice settings footer */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Radio className="h-3 w-3 text-secondary" />
                    <span className="text-[10px] text-muted-foreground">
                      Voice:{" "}
                      <select
                        value={voice}
                        onChange={(e) => setVoice(e.target.value)}
                        className="bg-transparent text-[10px] font-medium text-foreground focus:outline-none"
                        aria-label="Select TTS voice"
                      >
                        <option value="tongtong">tongtong</option>
                        <option value="echo">echo</option>
                        <option value="chime">chime</option>
                        <option value="breeze">breeze</option>
                      </select>
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>Auto-speak replies</span>
                    <Switch
                      checked={autoSpeak}
                      onCheckedChange={setAutoSpeak}
                      aria-label="Toggle auto-speak"
                    />
                    <Badge
                      variant="outline"
                      className="ml-1 h-4 px-1.5 text-[9px] text-muted-foreground"
                    >
                      {autoSpeak ? "on" : "off"}
                    </Badge>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Floating Action Button (collapsed state) ─────────────────── */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              key="fab"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-center"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="mf-gradient relative flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
                    aria-label="Open MedFlow AI Operations Copilot"
                  >
                    <Bot className="h-7 w-7" />
                    {/* Online dot */}
                    <span className="mf-pulse absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">AI Operations Copilot</TooltipContent>
              </Tooltip>
              <span className="mt-1 hidden rounded-full bg-card px-2 py-0.5 text-[9px] font-medium text-muted-foreground shadow-sm sm:block">
                Ask Copilot
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

export default VoiceChatbot;
