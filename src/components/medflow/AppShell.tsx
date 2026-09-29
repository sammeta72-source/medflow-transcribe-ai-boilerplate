"use client";
// MedFlow App Shell — left sidebar (deep teal #0B5345) + top header (mint bg)
// + sticky footer. Used for the entire in-app experience.
// RBAC-aware (Task 8): nav items filtered by current role's permissions,
// header has a role switcher that opens the Roles panel.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity, AlertTriangle, BarChart3, Bell, Bot, CalendarClock, ClipboardList,
  CreditCard, FileStack, FileText, FileOutput, HelpCircle, Inbox, KanbanSquare,
  LayoutDashboard, LogOut, MessageCircleQuestion, type LucideIcon, Pencil, Plug,
  ScanLine, Search, Send, Settings, ShieldAlert, ShieldCheck, Stethoscope,
  Upload, Users, UserCircle2, X, Menu, Building2, ChevronDown, Moon, Sun,
  Bot as BotIcon, Globe, Lock, UserCog,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_NAME, NAV_GROUPS, NAV_ITEMS } from "@/lib/medflow/constants";
import { useRbac } from "@/hooks/medflow/useRbac";
import { RolesPanel } from "@/components/medflow/RolesPanel";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, KanbanSquare, Inbox, Upload, FileText, MessageCircleQuestion,
  ShieldCheck, FileStack, BarChart3, Bot, Plug, Users, CreditCard, ShieldAlert,
  Settings, Activity, AlertTriangle, CalendarClock, ClipboardList, FileOutput,
  ScanLine, Send, Stethoscope, UserCircle2, Pencil, Lock, UserCog,
};

interface Props {
  active: string;
  onNavigate: (id: string) => void;
  children: React.ReactNode;
  unreadNotifs: number;
  onShowNotifications: () => void;
  currentUser: { name: string; role: string; email: string };
  onExit: () => void;
}

export function AppShell({ active, onNavigate, children, unreadNotifs, onShowNotifications, currentUser, onExit }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [rolesPanelOpen, setRolesPanelOpen] = useState(false);

  // RBAC (Task 8) — derive the effective user from the store; fall back to the
  // currentUser prop for backward compatibility if the store is empty.
  const rbac = useRbac();
  const effectiveUser = rbac.userName ? { name: rbac.userName, role: rbac.role, email: rbac.userEmail } : currentUser;

  // Filter nav items by the current role's permissions. Always include the
  // RBAC panel entry so the switcher is reachable.
  const navByGroup = useMemo(() => {
    const filteredItems = NAV_ITEMS.filter(i => rbac.canAccessSection(i.id));
    return NAV_GROUPS.map(g => ({
      ...g,
      items: filteredItems.filter(i => i.group === g.id),
    })).filter(g => g.items.length > 0);
  }, [rbac]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar — deep teal */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0B5345] text-white transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#1ABC9C] to-[#16a085] shadow-md">
            <BotIcon className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight text-white">MedFlow</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#1ABC9C]">Transcribe AI</span>
          </div>
          <button
            className="ml-auto rounded-md p-1 text-white/70 hover:bg-white/10 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tenant switcher */}
        <div className="px-3 py-3">
          <button className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-left text-xs text-white/90 ring-1 ring-white/10 transition hover:bg-white/10">
            <Building2 className="h-3.5 w-3.5 text-[#1ABC9C]" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[11px] font-semibold">Cardinal Health Systems</span>
              <span className="truncate text-[9px] text-white/60">Professional · Trial</span>
            </div>
            <ChevronDown className="h-3 w-3 text-white/50" />
          </button>
        </div>

        {/* Nav — styled vertical scrollbar (mf-scroll-dark) so the sea-green
            thumb + visible track is always present on the deep-teal sidebar.
           min-h-0 is REQUIRED so the flex child can shrink below its content
           size and actually scroll (otherwise it grows to fit, no scrollbar). */}
        <div className="mf-scroll-dark min-h-0 flex-1 px-2">
          <nav className="flex flex-col gap-4 pb-4">
            {navByGroup.map(group => (
              <div key={group.id} className="flex flex-col gap-0.5">
                <p className="px-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-white/40">
                  {group.label}
                </p>
                {group.items.map(item => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  const isActive = active === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition",
                        isActive
                          ? "bg-[#1ABC9C] text-white shadow-sm"
                          : "text-white/75 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-white/60 group-hover:text-[#1ABC9C]")} strokeWidth={2} />
                      <span className="truncate">{item.label}</span>
                      {item.id === "queue" && (
                        <Badge className="ml-auto h-4 px-1 text-[9px] font-bold" variant="secondary">3</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={() => setRolesPanelOpen(true)}
            className="mb-2 flex w-full items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[10px] text-white/80 transition hover:bg-white/10"
            title="Open Roles & Permissions panel"
          >
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
              <Lock className="h-3 w-3 text-[#1ABC9C]" /> Role: {effectiveUser.role}
            </span>
            <span className="flex items-center gap-0.5 text-white/60">
              Switch <ChevronDown className="h-3 w-3" />
            </span>
          </button>
          <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
            <Avatar className="h-8 w-8 border border-white/20">
              <AvatarFallback className="bg-[#1ABC9C] text-[10px] font-bold text-white">
                {effectiveUser.name.split(" ").map(s => s[0]).slice(0,2).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[11px] font-semibold text-white">{effectiveUser.name}</span>
              <span className="truncate text-[9px] text-white/60">{effectiveUser.role}</span>
            </div>
            <button onClick={onExit} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop (mobile) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <button
            className="rounded-md p-1.5 hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Global search */}
          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search jobs, patients (SYN-), providers, MRNs, job numbers…"
              className="h-9 pl-9 pr-16 text-sm"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-9 w-9" title="Health status">
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mf-pulse" /> All systems
              </span>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" title="Help">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9"
              title="Notifications"
              onClick={onShowNotifications}
            >
              <Bell className="h-4 w-4" />
              {unreadNotifs > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#1ABC9C] px-1 text-[9px] font-bold text-white">
                  {unreadNotifs}
                </span>
              )}
            </Button>
            <div className="h-5 w-px bg-border" />
            <button
              onClick={() => setRolesPanelOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-primary hover:bg-primary/5"
              title="Switch role & view permissions"
            >
              <UserCog className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">{effectiveUser.role}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            <Avatar className="h-7 w-7 border border-border">
              <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                {effectiveUser.name.split(" ").map(s => s[0]).slice(0,2).join("")}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>

        {/* Sticky footer */}
        <footer className="mt-auto border-t border-border bg-[#17202A] px-4 py-3 text-[11px] text-white/70 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1ABC9C]" />
                HIPAA-aligned controls · Audit-logged · MFA enforced
              </span>
              <span className="hidden text-white/30 sm:inline">·</span>
              <span className="hidden items-center gap-1 sm:flex">
                <Globe className="h-3.5 w-3.5 text-[#1ABC9C]" />
                FastAPI agents on :8000 · SQLite (active) · FHIR R4
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/50">© {new Date().getFullYear()} MedFlow Transcribe AI</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">Demo Tenant · Synthetic Data</span>
            </div>
          </div>
        </footer>
      </div>
      <RolesPanel open={rolesPanelOpen} onOpenChange={setRolesPanelOpen} />
    </div>
  );
}
