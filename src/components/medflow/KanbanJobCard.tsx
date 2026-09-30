"use client";
// MedFlow Kanban Job Card — EXACT match to the supplied Image 2 design.
// White card body (~80%) + colored right vertical accent tab (~20%) with a large
// numeral (SLA hours remaining). Top-left circular line-art icon (dictation type).
// Uppercase heading (Patient ref + MRN). Body = dictation details.
// Priority dot + status badges + assignee avatar at bottom.
//
// Each column on the board maps to one Image-2 accent color (.mf-tab-yellow…pink),
// so the card's right tab color follows its current column.

import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Bot, Clock, FileAudio, Stethoscope, Send, Inbox,
  Pencil, ShieldCheck, Mic, UserCircle2, type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_STYLES, SLA_RISK_STYLES, type KanbanColumn } from "@/lib/medflow/constants";
import type { JobWithRelations, Priority } from "@/lib/medflow/types";
import { formatDuration, formatSlaRemaining } from "@/lib/medflow/format";

interface Props {
  job: JobWithRelations;
  column: KanbanColumn;
  onClick: () => void;
}

// Dictation-type → icon mapping (line-art circular icons like Image 2)
const DOC_TYPE_ICONS: Record<string, LucideIcon> = {
  "SOAP Note": Stethoscope,
  "Consultation Note": UserCircle2,
  "H&P": FileAudio,
  "Operative Report": Activity,
  "Discharge Summary": Send,
  "Radiology Report": Inbox,
  "Procedure Note": Pencil,
  "Follow-up Note": Clock,
};

export function KanbanJobCard({ job, column, onClick }: Props) {
  const Icon = DOC_TYPE_ICONS[job.documentType] ?? FileAudio;
  const priority = (job.priority as Priority) ?? "Routine";
  const priorityStyle = PRIORITY_STYLES[priority];
  const sla = formatSlaRemaining(job.slaDeadline);
  const slaToneClass =
    sla.tone === "danger" ? "text-red-600 dark:text-red-400"
    : sla.tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : "text-emerald-600 dark:text-emerald-400";

  // The big numeral on the colored right tab = SLA hours remaining
  // (or a fall-back like priority rank / event count).
  const bigNumeral = (() => {
    if (!job.slaDeadline) return "—";
    const hours = (new Date(job.slaDeadline).getTime() - Date.now()) / 3600000;
    if (hours <= 0) return "!";
    if (hours < 1) return Math.max(1, Math.round(hours * 60)).toString(); // minutes if <1h
    return Math.round(hours).toString();
  })();

  const assignee = job.assignedTo;
  const initials = assignee
    ? assignee.name.split(" ").map(s => s[0]).slice(0, 2).join("")
    : "UN";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      layoutId={`job-card-${job.id}`}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="group relative flex w-full overflow-hidden rounded-xl bg-white text-left shadow-[0_4px_20px_rgba(11,83,69,0.08)] ring-1 ring-black/[0.04] transition-shadow hover:shadow-[0_8px_30px_rgba(11,83,69,0.18)] dark:bg-[#1f2937] dark:ring-white/5"
      aria-label={`${job.jobNumber} — ${job.documentType} for ${job.provider?.name ?? "Unknown provider"}`}
    >
      {/* White body (~80%) */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Row 1: icon circle (top-left, line-art) + priority dot + job number */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-foreground/70 text-foreground/80">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {job.jobNumber}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                {job.documentType}
              </span>
            </div>
          </div>
          <span className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${priorityStyle.dot}`} />
            <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">{priority}</span>
          </span>
        </div>

        {/* Row 2: heading — Patient ref + MRN (uppercase, bold, dark gray like Image 2) */}
        <div className="mt-0.5 text-sm font-bold uppercase tracking-wide text-foreground">
          {job.patientRef ?? "Unknown"} <span className="text-muted-foreground">·</span>{" "}
          <span className="font-medium text-foreground/70">{job.encounterRef ?? "ENC-?"}</span>
        </div>

        {/* Row 3: body — dictation details (5 lines, light gray, generous line height per Image 2) */}
        <p className="text-[11px] font-normal leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground/70">Provider:</span>{" "}
          {job.provider?.name ?? "—"}<br />
          <span className="font-semibold text-foreground/70">Facility:</span>{" "}
          {job.facility?.name ?? "—"}<br />
          <span className="font-semibold text-foreground/70">Dept:</span>{" "}
          {job.department?.name ?? "—"}{" · "}
          <span className="font-semibold text-foreground/70">Spec:</span>{" "}
          {job.specialty?.name ?? "—"}<br />
          <span className="font-semibold text-foreground/70">Audio:</span>{" "}
          {formatDuration(job.audioDurationSec)}{job.audioFileName ? ` · ${job.audioFileName.split(".").pop()?.toUpperCase()}` : ""}<br />
          {job.clientInstructions && (
            <span className="line-clamp-1 italic">
              <span className="font-semibold text-foreground/70">Note:</span> {job.clientInstructions}
            </span>
          )}
        </p>

        {/* Row 4: SLA + status badges + assignee avatar */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            <Clock className={`h-3.5 w-3.5 ${slaToneClass}`} strokeWidth={2} />
            <span className={`text-[11px] font-semibold ${slaToneClass}`}>{sla.text}</span>
          </div>
          {job.aiConfidence != null && (
            <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-semibold">
              <Bot className="h-3 w-3 text-secondary" />
              {(job.aiConfidence * 100).toFixed(0)}%
            </Badge>
          )}
          {job.qualityScore != null && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold">
              QA {job.qualityScore}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${priorityStyle.dot}`} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{job.slaRiskLabel}</span>
          </span>
          <Avatar className="h-6 w-6 border border-white shadow-sm dark:border-[#1f2937]">
            <AvatarFallback className="bg-primary text-[9px] font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {job.status === "Escalated" && (
          <div className="absolute right-16 top-3">
            <AlertTriangle className="h-4 w-4 text-red-500 mf-pulse" />
          </div>
        )}
        {job.status === "AI Transcription in progress" && (
          <div className="absolute right-16 top-3 flex items-end gap-0.5" aria-hidden>
            {[0,1,2,3,4].map(i => (
              <span
                key={i}
                className="mf-wave-bar block h-3 w-0.5 rounded bg-secondary"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right vertical accent tab (~20%) — Image-2 colored strip with big numeral */}
      <div className={`flex w-14 flex-col items-center justify-start gap-1 py-3 ${column.accent}`}>
        <span className="text-[9px] font-bold uppercase tracking-wider text-black/70">SLA</span>
        <span className="text-2xl font-extrabold leading-none text-white drop-shadow-sm">
          {bigNumeral}
        </span>
        <span className="text-[8px] font-medium uppercase tracking-wider text-black/60">
          {job.slaDeadline && (new Date(job.slaDeadline).getTime() - Date.now()) / 3600000 < 1 && (new Date(job.slaDeadline).getTime() - Date.now()) > 0 ? "min" : "hrs"}
        </span>
        <div className="mt-auto flex flex-1 items-center justify-center">
          <Mic className="h-4 w-4 text-white/70" strokeWidth={1.5} />
        </div>
      </div>
    </motion.button>
  );
}
