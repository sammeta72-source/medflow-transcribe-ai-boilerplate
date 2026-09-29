"use client";
// MedFlow — Jobs Workflow Board (Kanban with drag-and-drop).
// Columns come from KANBAN_COLUMNS; cards from /api/medflow/jobs.
// Drag a card onto another column to update its status (locally + toast + API POST).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Bot, HelpCircle, Inbox, KanbanSquare, LayoutGrid,
  Pencil, RefreshCw, Search, Send, ShieldCheck, Stethoscope, X,
} from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable,
  type DragEndEvent, type DragStartEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KanbanJobCard } from "@/components/medflow/KanbanJobCard";
import { useFetch } from "@/hooks/medflow/useFetch";
import {
  KANBAN_COLUMNS, PRIORITY_STYLES, type KanbanColumn,
} from "@/lib/medflow/constants";
import type { JobWithRelations } from "@/lib/medflow/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader, SectionError } from "./_shared";

interface Props {
  onOpenJob: (j: JobWithRelations) => void;
  refreshKey: number;
}

const FILTERS = ["All", "Routine", "Urgent", "STAT", "At Risk", "Escalated"] as const;
type Filter = typeof FILTERS[number];

function matchesFilter(j: JobWithRelations, f: Filter): boolean {
  if (f === "All") return true;
  if (f === "Routine" || f === "Urgent" || f === "STAT") return j.priority === f;
  if (f === "At Risk") return j.slaRiskLabel === "at-risk" || j.slaRiskLabel === "breach";
  if (f === "Escalated") return j.status === "Escalated";
  return true;
}

function matchesSearch(j: JobWithRelations, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    j.jobNumber.toLowerCase().includes(needle) ||
    (j.patientRef ?? "").toLowerCase().includes(needle) ||
    (j.provider?.name ?? "").toLowerCase().includes(needle) ||
    (j.documentType ?? "").toLowerCase().includes(needle) ||
    (j.specialty?.name ?? "").toLowerCase().includes(needle)
  );
}

// ── Draggable card wrapper ──────────────────────────────────────────────
function DraggableCard({
  job, column, onOpen,
}: { job: JobWithRelations; column: KanbanColumn; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { type: "job", columnId: column.id, status: job.status },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <KanbanJobCard job={job} column={column} onClick={onOpen} />
    </div>
  );
}

// ── Column droppable wrapper ─────────────────────────────────────────────
function Column({
  column, jobs, onOpen, isOver,
}: { column: KanbanColumn; jobs: JobWithRelations[]; onOpen: (j: JobWithRelations) => void; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: `col-${column.id}` });
  return (
    <div className="flex w-80 shrink-0 flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 shadow-sm">
        <span className={cn("h-3 w-3 rounded-sm", column.accent)} />
        <div className="flex flex-col">
          <span className="text-[12px] font-bold uppercase tracking-wide text-foreground">
            {column.label}
          </span>
          <span className="text-[10px] text-muted-foreground">{column.help}</span>
        </div>
        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px] font-bold">
          {jobs.length}
        </Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground" aria-label={`Help: ${column.help}`}>
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{column.help}</TooltipContent>
        </Tooltip>
      </div>

      {/* Body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-secondary bg-secondary/10" : "border-border bg-muted/30",
          "min-h-[200px]",
        )}
      >
        <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-8 text-[11px] text-muted-foreground">
              No jobs
            </div>
          ) : (
            jobs.map(job => (
              <DraggableCard key={job.id} job={job} column={column} onOpen={() => onOpen(job)} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function JobsKanban({ onOpenJob, refreshKey }: Props) {
  // Fetch jobs; bump refreshKey to re-fetch
  const url = useMemo(() => `/api/medflow/jobs?_k=${refreshKey}`, [refreshKey]);
  const { data, loading, error, refresh } = useFetch<{ jobs: JobWithRelations[] }>(url);

  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [activeJob, setActiveJob] = useState<JobWithRelations | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Local overrides (keyed by job id) so the board moves instantly on drop,
  // before the API call resolves. Derived from server data via useMemo — no effect needed.
  const [overrides, setOverrides] = useState<Record<string, Partial<JobWithRelations>>>({});
  const jobs = useMemo(() =>
    (data?.jobs ?? []).map(j => ({ ...j, ...overrides[j.id] })),
    [data, overrides]);

  // Group by column
  const jobsByColumn = useMemo(() => {
    const map: Record<string, JobWithRelations[]> = {};
    for (const c of KANBAN_COLUMNS) map[c.id] = [];
    for (const j of jobs) {
      const c = KANBAN_COLUMNS.find(c => c.statuses.includes(j.status)) ?? KANBAN_COLUMNS[0];
      if (matchesFilter(j, filter) && matchesSearch(j, search)) {
        map[c.id].push(j);
      }
    }
    return map;
  }, [jobs, filter, search]);

  function findColumnByStatus(status: string) {
    return KANBAN_COLUMNS.find(c => c.statuses.includes(status as JobWithRelations["status"])) ?? KANBAN_COLUMNS[0];
  }

  function onDragStart(e: DragStartEvent) {
    const j = jobs.find(j => j.id === e.active.id);
    setActiveJob(j ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveJob(null);
    setOverColumnId(null);
    const { active, over } = e;
    if (!over) return;
    // over could be a column droppable (`col-${columnId}`) or a sortable card.
    const overId = String(over.id);
    const targetColId = overId.startsWith("col-") ? overId.slice(4) : null;
    const overJob = jobs.find(j => j.id === over.id);
    const targetColumn =
      targetColId ? KANBAN_COLUMNS.find(c => c.id === targetColId) ?? null
      : overJob ? findColumnByStatus(overJob.status) : null;
    if (!targetColumn) return;
    const draggedJob = jobs.find(j => j.id === active.id);
    if (!draggedJob) return;
    // No-op if same column already
    if (targetColumn.statuses.includes(draggedJob.status)) {
      toast.info(`${draggedJob.jobNumber} already in ${targetColumn.label}`);
      return;
    }
    // Optimistic local override
    const newStatus = targetColumn.statuses[0];
    setOverrides(prev => ({ ...prev, [draggedJob.id]: { status: newStatus as JobWithRelations["status"] } }));
    toast.success(`${draggedJob.jobNumber} moved to ${targetColumn.label}`, {
      description: `Status → ${newStatus}`,
    });
    // Fire-and-forget POST to the Next route handler
    try {
      await fetch("/api/medflow/job-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: draggedJob.id,
          action: "set",
          status: newStatus,
          actorName: "Dana Whitfield",
        }),
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to persist status change");
    }
  }

  if (loading) return (
    <div>
      <PageHeader title="Jobs — Workflow Board" description="Drag-and-drop transcription jobs across the pipeline." icon={KanbanSquare} />
      <div className="flex gap-3 overflow-x-auto pb-3 mf-scroll-lg">
        {KANBAN_COLUMNS.map(c => (
          <div key={c.id} className="w-80 shrink-0">
            <Skeleton className="mb-2 h-12 w-full rounded-lg" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div>
      <PageHeader title="Jobs — Workflow Board" description="Drag-and-drop transcription jobs across the pipeline." icon={KanbanSquare} />
      <SectionError message={error} onRetry={refresh} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Jobs — Workflow Board"
        description="Drag-and-drop transcription jobs across the pipeline. Each column matches a workflow state."
        icon={KanbanSquare}
        actions={
          <>
            <div className="hidden items-center rounded-lg border border-border bg-card p-0.5 sm:flex">
              <button
                className={cn("rounded-md p-1.5 text-xs", view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                onClick={() => setView("kanban")}
                aria-label="Kanban view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn("rounded-md p-1.5 text-xs", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <KanbanSquare className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search JOB / patient / provider…"
            className="h-9 pl-9 pr-8 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {view === "kanban" ? (
        <TooltipProvider delayDuration={150}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
              const overId = String(e.over?.id ?? "");
              setOverColumnId(overId.startsWith("col-") ? overId.slice(4) : null);
            }}
          >
            <div className="flex gap-3 overflow-x-auto pb-3 mf-scroll-lg" style={{ scrollbarWidth: "thin" }}>
              {KANBAN_COLUMNS.map(column => (
                <Column
                  key={column.id}
                  column={column}
                  jobs={jobsByColumn[column.id] ?? []}
                  onOpen={onOpenJob}
                  isOver={overColumnId === column.id}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
              {activeJob ? (
                <div className="w-80 rotate-2 opacity-95 shadow-2xl">
                  <KanbanJobCard
                    job={activeJob}
                    column={findColumnByStatus(activeJob.status)}
                    onClick={() => onOpenJob(activeJob)}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TooltipProvider>
      ) : (
        <JobsList jobs={jobs} onOpen={onOpenJob} />
      )}

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-3 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">Priority:</span>
        {(Object.keys(PRIORITY_STYLES) as (keyof typeof PRIORITY_STYLES)[]).map(p => (
          <span key={p} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${PRIORITY_STYLES[p].dot}`} /> {p}
          </span>
        ))}
        <span className="mx-2 text-border">|</span>
        <span className="font-semibold text-foreground">Tabs:</span>
        {KANBAN_COLUMNS.map(c => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${c.accent}`} /> {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── List view (compact) ──────────────────────────────────────────────────
function JobsList({ jobs, onOpen }: { jobs: JobWithRelations[]; onOpen: (j: JobWithRelations) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Job #</th>
            <th className="px-3 py-2 text-left font-semibold">Patient</th>
            <th className="px-3 py-2 text-left font-semibold">Provider</th>
            <th className="px-3 py-2 text-left font-semibold">Doc type</th>
            <th className="px-3 py-2 text-left font-semibold">Priority</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
            <th className="px-3 py-2 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(j => {
            const ps = PRIORITY_STYLES[j.priority];
            return (
              <tr key={j.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-3 py-2 font-mono text-[12px] font-semibold">{j.jobNumber}</td>
                <td className="px-3 py-2 text-[12px]">{j.patientRef ?? "—"}</td>
                <td className="px-3 py-2 text-[12px]">{j.provider?.name ?? "—"}</td>
                <td className="px-3 py-2 text-[12px]">{j.documentType}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ps.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ps.dot}`} /> {j.priority}
                  </span>
                </td>
                <td className="px-3 py-2 text-[12px]">{j.status}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => onOpen(j)}>Open</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
