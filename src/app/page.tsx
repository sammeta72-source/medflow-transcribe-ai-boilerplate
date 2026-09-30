"use client";
// MedFlow Transcribe AI — single-page orchestrator.
// Manages: auth-state (entered/landing), active section, current demo user,
// notifications panel, selected job for the drawer, and a refreshKey bumping
// when a job is advanced.

import { useCallback, useMemo, useState } from "react";
import { AppShell } from "@/components/medflow/AppShell";
import { VoiceChatbot } from "@/components/medflow/VoiceChatbot";
import { VoiceOps } from "@/components/medflow/VoiceOps";
import { Landing } from "@/components/medflow/sections/Landing";
import { OverviewDashboard } from "@/components/medflow/sections/OverviewDashboard";
import { JobsKanban } from "@/components/medflow/sections/JobsKanban";
import { JobDetailDrawer } from "@/components/medflow/sections/JobDetailDrawer";
import { UploadDictation } from "@/components/medflow/sections/UploadDictation";
import { MyQueue } from "@/components/medflow/sections/MyQueue";
import { Documents } from "@/components/medflow/sections/Documents";
import { Clarifications } from "@/components/medflow/sections/Clarifications";
import { Quality } from "@/components/medflow/sections/Quality";
import { Templates } from "@/components/medflow/sections/Templates";
import { Analytics } from "@/components/medflow/sections/Analytics";
import { AIAgents } from "@/components/medflow/sections/AIAgents";
import { Integrations } from "@/components/medflow/sections/Integrations";
import { Team } from "@/components/medflow/sections/Team";
import { LiveDictation } from "@/components/medflow/sections/LiveDictation";
import { WorkflowRouting } from "@/components/medflow/sections/WorkflowRouting";
import { WorkforceMgmt } from "@/components/medflow/sections/WorkforceMgmt";
import { SmartFhir } from "@/components/medflow/sections/SmartFhir";
import { PatientPortal } from "@/components/medflow/sections/PatientPortal";
import { HipaaSra } from "@/components/medflow/sections/HipaaSra";
import { AutoPilot } from "@/components/medflow/sections/AutoPilot";
import { AutonomousSOC } from "@/components/medflow/sections/AutonomousSOC";
import { ModelHealth } from "@/components/medflow/sections/ModelHealth";
import { Explainability } from "@/components/medflow/sections/Explainability";
import { StripeBilling } from "@/components/medflow/sections/StripeBilling";
import { AuditSecurity } from "@/components/medflow/sections/AuditSecurity";
import { Settings } from "@/components/medflow/sections/Settings";
import { Copilot } from "@/components/medflow/sections/Copilot";
import { ContinuousCompliance } from "@/components/medflow/sections/ContinuousCompliance";
import { ClientPortal } from "@/components/medflow/sections/ClientPortal";
import { MobileApp } from "@/components/medflow/sections/MobileApp";
import { DEMO_USERS } from "@/lib/medflow/constants";
import type { JobWithRelations } from "@/lib/medflow/types";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Check } from "lucide-react";
import { useFetch } from "@/hooks/medflow/useFetch";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  recipient: string | null;
  role: string | null;
  createdAt: string;
}

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState("overview");
  const [demoUserIdx, setDemoUserIdx] = useState(0); // Dana Whitfield (Tenant Owner) by default
  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithRelations | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const currentUser = useMemo(() => {
    const u = DEMO_USERS[demoUserIdx];
    return { name: u.name, role: u.role, email: u.email };
  }, [demoUserIdx]);

  const notifFetch = useFetch<{ notifications: Notification[]; unreadNotifs?: number }>("/api/medflow/dashboard");

  const unread = notifFetch.data?.unreadNotifs ?? notifFetch.data?.notifications?.filter(n => !n.readAt).length ?? 0;

  const onAdvanced = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  if (!entered) {
    return (
      <>
        <Landing onEnter={() => setEntered(true)} />
        {/* Floating voice-enabled AI chatbot (additive overlay — Task 7) */}
        <VoiceChatbot />
        {/* Voice Operations widget (Task 19) — hands-free platform control.
            On the landing page, navigating via voice also enters the app. */}
        <VoiceOps
          onNavigate={(sectionId: string) => {
            setEntered(true);
            setActive(sectionId);
          }}
        />
      </>
    );
  }

  return (
    <AppShell
      active={active}
      onNavigate={setActive}
      unreadNotifs={unread}
      onShowNotifications={() => setNotifOpen(true)}
      currentUser={currentUser}
      onExit={() => { setEntered(false); setActive("overview"); }}
    >
      {active === "overview" && <OverviewDashboard />}
      {active === "jobs" && (
        <JobsKanban
          onOpenJob={(j) => setSelectedJob(j)}
          refreshKey={refreshKey}
        />
      )}
      {active === "queue" && (
        <MyQueue onOpenJob={(j) => setSelectedJob(j)} />
      )}
      {active === "upload" && (
        <UploadDictation onSubmitted={() => { setActive("jobs"); onAdvanced(); }} />
      )}
      {active === "autopilot" && <AutoPilot />}
      {active === "model-health" && <ModelHealth />}
      {active === "explainability" && <Explainability />}
      {active === "streaming" && <LiveDictation />}
      {active === "documents" && <Documents />}
      {active === "clarifications" && <Clarifications />}
      {active === "quality" && <Quality />}
      {active === "templates" && <Templates />}
      {active === "analytics" && <Analytics />}
      {active === "agents" && <AIAgents />}
      {active === "integrations" && <Integrations />}
      {active === "copilot" && <Copilot />}
      {active === "workflow" && <WorkflowRouting />}
      {active === "workforce" && <WorkforceMgmt />}
      {active === "compliance" && <ContinuousCompliance />}
      {active === "smart-fhir" && <SmartFhir />}
      {active === "patient-access" && <PatientPortal />}
      {active === "client-portal" && <ClientPortal />}
      {active === "mobile-app" && <MobileApp />}
      {active === "team" && <Team />}
      {active === "autonomous-soc" && <AutonomousSOC />}
      {active === "billing" && <StripeBilling />}
      {active === "audit" && <AuditSecurity />}
      {active === "sra" && <HipaaSra />}
      {active === "settings" && <Settings />}

      {/* Demo user switcher (overlay at top right of main, for demo) */}
      <DemoUserSwitcher
        index={demoUserIdx}
        onChange={setDemoUserIdx}
      />

      {/* Job detail drawer */}
      <JobDetailDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onAdvanced={onAdvanced}
      />

      {/* Notifications sheet */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="border-b border-border bg-card p-4">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-secondary" /> Notifications
              {unread > 0 && <Badge className="text-[10px] bg-secondary text-secondary-foreground">{unread} unread</Badge>}
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto p-2">
            {notifFetch.data?.notifications.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No notifications.</p>
            ) : (
              <ul className="space-y-1">
                {notifFetch.data?.notifications.map(n => (
                  <li
                    key={n.id}
                    className={`flex items-start gap-2 rounded-md p-2 hover:bg-muted/40 ${!n.readAt ? "bg-secondary/5" : ""}`}
                  >
                    {!n.readAt ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary mf-pulse" />
                    ) : (
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-foreground">{n.title}</p>
                      {n.body && <p className="text-[11px] text-muted-foreground">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground">{n.recipient} · {n.role}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating voice-enabled AI chatbot (additive overlay — Task 7) */}
      <VoiceChatbot />
      {/* Voice Operations widget (Task 19) — hands-free platform control */}
      <VoiceOps onNavigate={setActive} />
    </AppShell>
  );
}

// Small floating switcher so the user can change the demo user without leaving the app.
function DemoUserSwitcher({
  index, onChange,
}: {
  index: number;
  onChange: (i: number) => void;
}) {
  const u = DEMO_USERS[index];
  return (
    <div className="fixed bottom-4 right-4 z-30 hidden items-center gap-2 rounded-full border border-border bg-card p-1 pr-2 shadow-md sm:flex">
      <Avatar className="h-7 w-7 border border-border">
        <AvatarFallback className="bg-primary text-[9px] font-bold text-primary-foreground">
          {u.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
        </AvatarFallback>
      </Avatar>
      <select
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent text-[11px] font-medium text-foreground focus:outline-none"
        aria-label="Switch demo user"
      >
        {DEMO_USERS.map((d, i) => (
          <option key={d.email} value={i}>{d.name} · {d.role}</option>
        ))}
      </select>
    </div>
  );
}
