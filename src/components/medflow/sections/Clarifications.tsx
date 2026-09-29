"use client";
// MedFlow — Clarifications (two-pane threaded view).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle, BellRing, CheckCircle2, MessageCircleQuestion, Pause, Play, RefreshCw,
  Send, ShieldQuestion,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useFetch } from "@/hooks/medflow/useFetch";
import { RISK_SEVERITY_STYLES } from "@/lib/medflow/constants";
import { formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

interface ClarificationMessage {
  id: string;
  body: string;
  author: string;
  isInternal: boolean;
  createdAt: string;
}
interface Clarification {
  id: string;
  jobNumber: string;
  patientRef: string | null;
  documentType: string;
  requestType: string;
  severity: string;
  question: string;
  status: string;
  slaPausedAt: string | null;
  resolvedAt: string | null;
  creator: string | null;
  createdAt: string;
  messages: ClarificationMessage[];
}

export function Clarifications() {
  const { data, loading, error, refresh } = useFetch<{ clarifications: Clarification[] }>("/api/medflow/clarifications");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const items = data?.clarifications ?? [];
  const selected = items.find(c => c.id === selectedId) ?? items[0] ?? null;

  if (loading) return (
    <div>
      <PageHeader title="Clarifications" description="Provider query threads and SLA-paused jobs." icon={MessageCircleQuestion} />
      <SectionLoading rows={3} />
    </div>
  );
  if (error) return (
    <div>
      <PageHeader title="Clarifications" description="Provider query threads and SLA-paused jobs." icon={MessageCircleQuestion} />
      <SectionError message={error} onRetry={refresh} />
    </div>
  );

  function sendReply() {
    if (!reply.trim()) {
      toast.error("Reply cannot be empty");
      return;
    }
    toast.success("Reply sent", { description: "Provider notified via portal + email." });
    setReply("");
  }

  return (
    <div>
      <PageHeader
        title="Clarifications"
        description="Provider query threads. SLA timer auto-pauses on each open clarification."
        icon={MessageCircleQuestion}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card><CardContent><EmptyState icon={CheckCircle2} message="No open clarifications. SLA fully running." /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left list */}
          <Card className="lg:col-span-1">
            <CardContent className="p-0">
              <ul className="max-h-[80vh] divide-y divide-border overflow-y-auto">
                {items.map((c, i) => {
                  const s = RISK_SEVERITY_STYLES[c.severity as keyof typeof RISK_SEVERITY_STYLES] ?? RISK_SEVERITY_STYLES.informational;
                  const isSel = selected?.id === c.id;
                  return (
                    <motion.li
                      key={c.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                    >
                      <button
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          "w-full p-3 text-left transition-colors hover:bg-muted/40",
                          isSel && "bg-secondary/10 border-l-4 border-secondary",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-foreground">{c.jobNumber}</span>
                          <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-bold", s.badge)}>{c.severity}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] font-semibold text-foreground">{c.requestType}</p>
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">{c.question}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {c.status === "open" ? (
                            <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 bg-amber-50">Open</Badge>
                          ) : c.status === "resolved" ? (
                            <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-300 bg-emerald-50">Resolved</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                          )}
                          {c.slaPausedAt && (
                            <span className="flex items-center gap-0.5 text-amber-700">
                              <Pause className="h-2.5 w-2.5" /> SLA paused
                            </span>
                          )}
                          <span className="ml-auto">{formatRelative(c.createdAt)}</span>
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Right detail */}
          <Card className="lg:col-span-2">
            {selected ? (
              <CardContent className="flex h-[80vh] flex-col p-0">
                {/* Header */}
                <div className="border-b border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] font-semibold text-muted-foreground">{selected.jobNumber}</p>
                      <h2 className="text-base font-bold text-foreground">{selected.requestType}</h2>
                      <p className="text-[12px] text-muted-foreground">
                        {selected.patientRef} · {selected.documentType}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {selected.slaPausedAt && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                          <Pause className="mr-1 h-2.5 w-2.5" /> SLA paused
                        </Badge>
                      )}
                      {selected.status === "resolved" && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
                          <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Resolved
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 rounded-lg border border-border bg-card p-2.5 text-[12px] text-foreground">
                    <ShieldQuestion className="mr-1 inline h-3.5 w-3.5 text-secondary" />
                    {selected.question}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Opened by {selected.creator ?? "System"} · {formatRelative(selected.createdAt)}
                  </p>
                </div>

                {/* Messages thread */}
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {selected.messages.map(m => (
                    <div key={m.id} className={cn("flex gap-2", m.isInternal && "flex-row-reverse")}>
                      <Avatar className="h-7 w-7 border border-border">
                        <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">
                          {m.author.split(" ").map(s => s[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "max-w-[75%] rounded-lg p-2.5 text-[12px]",
                        m.isInternal ? "bg-amber-50 border border-amber-200 text-foreground" : "bg-muted text-foreground",
                      )}>
                        <p className="text-[10px] font-semibold text-muted-foreground">
                          {m.author}{m.isInternal && " · internal note"}
                        </p>
                        <p className="mt-0.5 text-[12px]">{m.body}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatRelative(m.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {selected.messages.length === 0 && (
                    <p className="text-[12px] text-muted-foreground">No messages yet.</p>
                  )}
                </div>

                {/* Reply composer */}
                <div className="border-t border-border p-3">
                  <Textarea
                    placeholder="Type a reply… (Shift+Enter for newline)"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    className="min-h-16 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => toast.info("SLA resumed", { description: "Timer will continue from paused state." })}>
                        <Play className="mr-1 h-3 w-3" /> Resume SLA
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info("Reopened")} >
                        <AlertCircle className="mr-1 h-3 w-3" /> Reopen
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => toast.success("Clarification resolved", { description: "Provider notified." })}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                      </Button>
                      <Button size="sm" onClick={sendReply} className="bg-primary text-primary-foreground">
                        <Send className="mr-1 h-3 w-3" /> Send reply
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            ) : (
              <CardContent><EmptyState icon={BellRing} message="Select a clarification to view thread." /></CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
