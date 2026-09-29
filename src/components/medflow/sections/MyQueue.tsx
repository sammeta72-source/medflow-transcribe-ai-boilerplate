"use client";
// MedFlow — My Queue (assigned jobs for the active demo user).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Clock, Inbox, RefreshCw, UserCircle2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/hooks/medflow/useFetch";
import { DEMO_USERS, PRIORITY_STYLES, SLA_RISK_STYLES, STATUS_META } from "@/lib/medflow/constants";
import { formatDateTime, formatSlaRemaining } from "@/lib/medflow/format";
import type { JobWithRelations } from "@/lib/medflow/types";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader, SectionError, StatCard } from "./_shared";

interface Props {
  onOpenJob: (j: JobWithRelations) => void;
}

const DEMO_USER_IDS: Record<string, string> = {
  "sara.lin@offshore.medflow.demo": "u_editor1",
  "ananya.iyer@offshore.medflow.demo": "u_qa1",
  "vikram.sundaram@offshore.medflow.demo": "u_mgr1",
};

export function MyQueue({ onOpenJob }: Props) {
  const { data, loading, error, refresh } = useFetch<{ jobs: JobWithRelations[] }>("/api/medflow/jobs");
  const [demoUser, setDemoUser] = useState(DEMO_USERS[2]); // Sara Lin by default
  const [demoUserId, setDemoUserId] = useState("u_editor1");

  const myJobs = useMemo(() => {
    if (!data?.jobs) return [];
    // Heuristic: match by assignedTo.name OR by role
    return data.jobs.filter(j => j.assignedTo?.name === demoUser.name || (j.assignedToId && j.assignedToId === demoUserId));
  }, [data, demoUser, demoUserId]);

  if (loading) return (
    <div>
      <PageHeader title="My Queue" description="Assigned dictations awaiting your action." icon={Inbox} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="mt-4 h-96 rounded-xl" />
    </div>
  );

  if (error) return (
    <div>
      <PageHeader title="My Queue" description="Assigned dictations awaiting your action." icon={Inbox} />
      <SectionError message={error} onRetry={refresh} />
    </div>
  );

  function switchUser(email: string) {
    const u = DEMO_USERS.find(d => d.email === email) ?? DEMO_USERS[2];
    setDemoUser(u);
    setDemoUserId(DEMO_USER_IDS[email] ?? "u_editor1");
  }

  const myOpen = myJobs.filter(j => !["Delivered", "Rejected", "Cancelled"].includes(j.status)).length;
  const myAtRisk = myJobs.filter(j => j.slaRiskLabel === "at-risk" || j.slaRiskLabel === "breach").length;
  const myStat = myJobs.filter(j => j.priority === "STAT").length;
  const completedToday = myJobs.filter(j => j.status === "Delivered").length;

  return (
    <div>
      <PageHeader
        title="My Queue"
        description="Dictations assigned to you across the active workflow."
        icon={Inbox}
        actions={
          <>
            <Select value={demoUser.email} onValueChange={switchUser}>
              <SelectTrigger className="h-9 w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEMO_USERS.map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.name} · {u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      />

      {/* User banner */}
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-secondary/30 bg-secondary/5 p-3">
        <Avatar className="h-10 w-10 border border-border">
          <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
            {demoUser.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Viewing as: {demoUser.name}{" "}
            <span className="text-muted-foreground">· {demoUser.role}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">{demoUser.email}</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Inbox} label="My open" value={myOpen} accent="text-secondary" />
        <StatCard icon={AlertTriangle} label="At risk" value={myAtRisk} accent="text-amber-600" />
        <StatCard icon={Clock} label="STAT" value={myStat} accent="text-red-600" />
        <StatCard icon={CheckCircle2} label="Completed today" value={completedToday} accent="text-emerald-600" />
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {myJobs.length === 0 ? (
            <EmptyState icon={UserCircle2} message={`No jobs assigned to ${demoUser.name}. Switch demo user to see another queue.`} />
          ) : (
            <ul className="divide-y divide-border">
              {myJobs.map((j, i) => {
                const ps = PRIORITY_STYLES[j.priority];
                const sm = STATUS_META[j.status] ?? STATUS_META.Draft;
                const sla = formatSlaRemaining(j.slaDeadline);
                const slaClass = sla.tone === "danger" ? "text-red-600" : sla.tone === "warn" ? "text-amber-600" : "text-emerald-600";
                return (
                  <motion.li
                    key={j.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className="flex flex-col gap-3 p-3 hover:bg-muted/40 sm:flex-row sm:items-center"
                  >
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold uppercase text-foreground")} style={{ color: sm.color }}>
                        {j.jobNumber.split("-").pop()?.slice(-2)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {j.jobNumber} · {j.documentType}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {j.patientRef} · {j.provider?.name} · {j.specialty?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", ps.badge)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", ps.dot)} /> {j.priority}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", SLA_RISK_STYLES[j.slaRiskLabel ?? "on-track"].badge)}>
                        {sla.text}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{j.status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => onOpenJob(j)}>Open</Button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
