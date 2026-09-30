"use client";
// MedFlow — Voice Operations ("Hey MedFlow") floating widget (D9).
//
// Hands-free platform control via the browser Web Speech API:
//   * window.SpeechRecognition || window.webkitSpeechRecognition (streaming STT)
//   * speechSynthesis.speak(new SpeechSynthesisUtterance(response)) (TTS)
//
// Position: fixed bottom-36 right-4 — sits ABOVE the existing VoiceChatbot
// (which is at bottom-20 right-4) so the two FABs are visually stacked.
// z-index is raised to z-[60] so the expanded panel sits above VoiceChatbot's.
//
// All commands POST to /api/medflow/voice-ops {command} → returns
// {action, response, recognized, original_command, filter?}.
// If action starts with "navigate:", the onNavigate prop is invoked.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Mic, Radar, Square, Volume2, VolumeX, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ── Minimal Web Speech API typings (avoid pulling in @types) ──────────────
interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognitionResult { 0: SpeechRecognitionAlternative; isFinal: boolean; length: number; }
interface SpeechRecognitionResultList { length: number; item(i: number): SpeechRecognitionResult; [i: number]: SpeechRecognitionResult; }
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

interface VoiceOpsProps {
  onNavigate: (sectionId: string) => void;
}

interface VoiceOpsResponse {
  action: string;
  response: string;
  recognized: boolean;
  original_command: string;
  filter?: string;
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  recognized: boolean;
  ts: number;
}

const QUICK_COMMANDS = [
  "Show STAT jobs",
  "SLA risk",
  "QA pass rate",
  "Generate report",
  "Compliance",
  "Help",
];

const SUPPORTED =
  typeof window !== "undefined" &&
  Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

export function VoiceOps({ onNavigate }: VoiceOpsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptEndRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the transcript panel
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, interim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
      try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    };
  }, []);

  const pushTurn = useCallback((role: ChatTurn["role"], text: string, recognized: boolean) => {
    setTurns(prev => [
      ...prev,
      { id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, text, recognized, ts: Date.now() },
    ]);
  }, []);

  // Speak a response via the Web Speech API
  const speak = useCallback((text: string) => {
    if (!autoSpeak) return;
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        u.pitch = 1.0;
        u.volume = 0.9;
        window.speechSynthesis.speak(u);
      }
    } catch { /* silent */ }
  }, [autoSpeak]);

  // Send a command to the API + handle response
  const sendCommand = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed) return;
      setBusy(true);
      pushTurn("user", trimmed, true);
      try {
        const res = await fetch("/api/medflow/voice-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: trimmed }),
        });
        if (!res.ok) throw new Error(`voice-ops ${res.status}`);
        const data: VoiceOpsResponse = await res.json();
        pushTurn("assistant", data.response, data.recognized);
        if (data.recognized) {
          speak(data.response);
        }
        // Auto-navigate if action is navigate:section
        if (data.action?.startsWith("navigate:")) {
          const target = data.action.split(":")[1];
          if (target) {
            toast.success(`Navigating to ${target}`, { description: data.response });
            onNavigate(target);
            // close the panel so the user sees the new section
            setIsOpen(false);
          }
        }
      } catch (e) {
        const msg = (e as Error).message;
        pushTurn("assistant", `Voice ops failed: ${msg}`, false);
        toast.error(`Voice ops failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [onNavigate, pushTurn, speak],
  );

  // Start/stop listening via Web Speech API
  const startListening = useCallback(() => {
    if (!SUPPORTED) {
      toast.error("Voice recognition not supported in this browser. Use the quick-command chips below.");
      return;
    }
    const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition) as SpeechRecognitionCtor;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    transcriptEndRef.current = false;

    rec.onstart = () => {
      setListening(true);
      setInterim("");
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript;
        if (r.isFinal) finalText += txt;
        else interimText += txt;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim("");
        transcriptEndRef.current = true;
        // stop listening then send
        try { rec.stop(); } catch { /* noop */ }
        void sendCommand(finalText.trim());
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setListening(false);
      setInterim("");
      if (e.error === "no-speech") {
        toast.info("No speech detected — try again.");
      } else if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Microphone permission denied. Enable mic access to use voice commands.");
      } else {
        toast.error(`Voice error: ${e.error}`);
      }
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      toast.success("Listening…");
    } catch (e) {
      toast.error(`Could not start mic: ${(e as Error).message}`);
      setListening(false);
    }
  }, [sendCommand]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={250}>
      <div
        className="fixed bottom-36 right-4 z-[60] sm:bottom-36"
        role="region"
        aria-label="Voice Operations"
      >
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={cn(
                "flex h-[min(70vh,420px)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:w-[340px]",
              )}
              role="dialog"
              aria-modal="false"
              aria-label="Voice Operations panel"
            >
              {/* Header */}
              <header className="mf-gradient flex items-center justify-between gap-2 px-3 py-2.5 text-primary-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                    <Radar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">
                      Voice Operations
                    </p>
                    <p className="truncate text-[10px] text-white/75">
                      Hands-free platform control
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setAutoSpeak(v => !v)}
                        className="h-8 w-8 text-primary-foreground hover:bg-white/15"
                        aria-label="Toggle auto-speak"
                      >
                        {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {autoSpeak ? "Auto-speak responses ON" : "Auto-speak responses OFF"}
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8 text-primary-foreground hover:bg-white/15"
                    aria-label="Close voice ops"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              {/* Auto-speak toggle row */}
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Auto-speak responses
                </span>
                <Switch
                  checked={autoSpeak}
                  onCheckedChange={setAutoSpeak}
                  aria-label="Auto-speak responses"
                  className="data-[state=checked]:bg-secondary"
                />
              </div>

              {/* Transcript area */}
              <div
                ref={scrollRef}
                className="mf-scroll flex-1 space-y-2 overflow-y-auto bg-gradient-to-b from-background to-muted/10 p-3"
              >
                {turns.length === 0 && !listening && (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
                    <Radar className="h-8 w-8 text-secondary" />
                    <p className="text-[12px] font-medium text-foreground">Say a command or pick one below</p>
                    <p className="text-[10px]">e.g., “Show STAT jobs”</p>
                  </div>
                )}

                {turns.map(t => (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-2xl px-3 py-2 text-[12px] shadow-sm",
                      t.role === "user"
                        ? "ml-auto w-fit max-w-[85%] bg-primary text-primary-foreground"
                        : t.recognized
                          ? "mr-auto w-fit max-w-[90%] border border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "mr-auto w-fit max-w-[90%] border border-amber-300 bg-amber-50 text-amber-900",
                    )}
                  >
                    {t.text}
                  </div>
                ))}

                {listening && (
                  <div className="mr-auto flex w-fit max-w-[90%] items-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-900 shadow-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                    </span>
                    <span className="font-semibold">Listening…</span>
                    {interim && <span className="text-[11px] italic">“{interim}”</span>}
                  </div>
                )}

                {busy && !listening && (
                  <div className="mr-auto w-fit max-w-[80%] rounded-2xl border border-border bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                    Processing command…
                  </div>
                )}
              </div>

              {/* Quick-command chips */}
              <div className="border-t border-border bg-card p-2">
                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick commands
                </p>
                <div className="flex flex-wrap gap-1">
                  {QUICK_COMMANDS.map(cmd => (
                    <button
                      key={cmd}
                      type="button"
                      onClick={() => void sendCommand(cmd)}
                      disabled={busy || listening}
                      className="rounded-full border border-secondary/30 bg-secondary/10 px-2 py-1 text-[10px] font-medium text-secondary transition-colors hover:bg-secondary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mic button row */}
              <div className="border-t border-border bg-card p-3">
                {SUPPORTED ? (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => (listening ? stopListening() : startListening())}
                      disabled={busy}
                      aria-label={listening ? "Stop listening" : "Start listening"}
                      className={cn(
                        "relative grid h-14 w-14 place-items-center rounded-full text-white shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50",
                        listening ? "bg-red-600" : "mf-gradient",
                      )}
                    >
                      {listening ? (
                        <Square className="h-5 w-5 fill-current" />
                      ) : (
                        <Mic className="h-6 w-6" />
                      )}
                      {listening && (
                        <>
                          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
                          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-2 ring-card mf-pulse" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-center text-[11px] text-amber-800">
                    Voice recognition not supported in this browser. Use the quick-command chips above.
                  </p>
                )}
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  {listening ? "Tap to stop" : "Tap mic, then say a command"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB */}
        <div className="mt-2 flex justify-end">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  onClick={() => setIsOpen(o => !o)}
                  className="mf-gradient h-12 w-12 rounded-full p-0 shadow-lg ring-1 ring-white/25 hover:shadow-xl"
                  aria-label={isOpen ? "Close Voice Operations" : "Open Voice Operations"}
                >
                  {isOpen ? <X className="h-5 w-5" /> : <Radar className="h-5 w-5" />}
                  {!isOpen && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white mf-pulse" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-[11px] font-medium">Hey MedFlow — Voice Operations</p>
                <p className="text-[10px] text-muted-foreground">Hands-free control of every section</p>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        </div>

        {/* Status pill (collapsed state) */}
        {!isOpen && (
          <div className="pointer-events-none mt-1 flex justify-end">
            <Badge variant="outline" className="bg-card/80 text-[9px] font-medium text-muted-foreground backdrop-blur">
              Voice Ops
            </Badge>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
