"use client";
// RolesPanel — a modal showing the permission matrix + a role switcher.
// Additive (Task 8). Mounted from the AppShell header's role-switcher button.

import { motion } from "framer-motion";
import {
  Building2, Check, Crown, FileEdit, Gauge, Headset, LifeBuoy, Lock,
  Pencil, ShieldAlert, ShieldCheck, Stethoscope, Users, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  type Permission, type Role, ROLES, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS,
  roleHasPermission, SECTION_PERMISSIONS,
} from "@/lib/medflow/rbac";
import { useRbac } from "@/hooks/medflow/useRbac";

const ROLE_ICONS: Record<string, typeof Crown> = {
  Crown, Building2, Gauge, Stethoscope, Headset, Users, Pencil, FileEdit,
  ShieldCheck, LifeBuoy: LifeBuoy, ShieldAlert, LifeBuoy,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_SECTIONS: { id: string; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "jobs", label: "Jobs (Kanban)" },
  { id: "queue", label: "My Queue" },
  { id: "upload", label: "Upload Dictation" },
  { id: "documents", label: "Documents" },
  { id: "clarifications", label: "Clarifications" },
  { id: "quality", label: "Quality" },
  { id: "templates", label: "Templates" },
  { id: "analytics", label: "Analytics" },
  { id: "agents", label: "AI Agents" },
  { id: "integrations", label: "Integrations" },
  { id: "team", label: "Team" },
  { id: "billing", label: "Billing" },
  { id: "audit", label: "Audit & Security" },
  { id: "settings", label: "Settings" },
];

const ALL_ACTIONS: { id: Permission; label: string }[] = [
  { id: "action.upload_dictation", label: "Upload dictation" },
  { id: "action.assign", label: "Assign work" },
  { id: "action.reassign", label: "Reassign" },
  { id: "action.advance_workflow", label: "Advance workflow" },
  { id: "action.run_ai_agent", label: "Run AI agent" },
  { id: "action.request_clarification", label: "Request clarification" },
  { id: "action.resolve_clarification", label: "Resolve clarification" },
  { id: "action.qa_review", label: "QA review" },
  { id: "action.qa_reject", label: "QA reject / rework" },
  { id: "action.provider_approve", label: "Provider approve" },
  { id: "action.provider_sign", label: "Provider e-sign" },
  { id: "action.deliver", label: "Deliver document" },
  { id: "action.escalate", label: "Escalate" },
  { id: "action.cancel_job", label: "Cancel job" },
  { id: "action.edit_template", label: "Edit template" },
  { id: "action.manage_users", label: "Manage users" },
  { id: "action.manage_integrations", label: "Manage integrations" },
  { id: "action.manage_billing", label: "Manage billing" },
  { id: "action.view_audit", label: "View audit trail" },
  { id: "action.export_data", label: "Export data" },
  { id: "action.delete_tenant", label: "Delete tenant" },
];

export function RolesPanel({ open, onOpenChange }: Props) {
  const { role, setRole } = useRbac();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border bg-gradient-to-r from-primary to-[#0d6651] p-5 text-primary-foreground">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <Lock className="h-5 w-5" /> Roles &amp; Permissions
          </DialogTitle>
          <DialogDescription className="text-white/80">
            Role-based access control — switch roles to see how the UI changes.
            Additive layer — does not modify underlying components.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[80vh] grid-cols-1 gap-0 md:grid-cols-[260px_1fr]">
          {/* Role list (left) */}
          <div className="border-r border-border bg-muted/30 p-3 md:max-h-[80vh]">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Switch to demo role
            </p>
            <ScrollArea className="mf-scroll max-h-[72vh] pr-1">
              <ul className="space-y-1">
                {ROLES.map((r) => {
                  const desc = ROLE_DESCRIPTIONS[r];
                  const Icon = ROLE_ICONS[desc.icon] ?? Crown;
                  const isCurrent = r === role;
                  const perms = ROLE_PERMISSIONS[r] ?? [];
                  const isSuper = perms.includes("*");
                  return (
                    <li key={r}>
                      <button
                        onClick={() => setRole(r)}
                        className={cn(
                          "flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition",
                          isCurrent
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "border-transparent hover:border-border hover:bg-card",
                        )}
                      >
                        <span
                          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-white"
                          style={{ backgroundColor: desc.color }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-foreground">{r}</p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                            {desc.scope}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[9px] font-bold"
                            >
                              {isSuper ? "ALL" : perms.length} perms
                            </Badge>
                            {isCurrent && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold text-primary">
                                <Check className="h-3 w-3" /> Active
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>

          {/* Permission matrix (right) */}
          <div className="p-4 md:max-h-[80vh] md:overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-foreground">
                  {role} <span className="text-muted-foreground">· permission matrix</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Sections + workflow actions granted to this role.
                </p>
              </div>
              <Badge className="bg-secondary text-secondary-foreground">
                {(ROLE_PERMISSIONS[role] ?? []).includes("*")
                  ? "All permissions (super admin)"
                  : `${(ROLE_PERMISSIONS[role] ?? []).length} granted`}
              </Badge>
            </div>

            <ScrollArea className="mf-scroll max-h-[64vh] pr-1">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                key={role}
                className="space-y-4"
              >
                {/* Sections */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Section visibility
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {ALL_SECTIONS.map((s) => {
                      const perm = SECTION_PERMISSIONS[s.id];
                      const allowed = roleHasPermission(role, perm);
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px]",
                            allowed
                              ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                              : "border-border bg-muted/30 text-muted-foreground line-through",
                          )}
                        >
                          {allowed ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <X className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="truncate">{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Workflow actions
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {ALL_ACTIONS.map((a) => {
                      const allowed = roleHasPermission(role, a.id);
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px]",
                            allowed
                              ? "border-secondary bg-secondary/10"
                              : "border-border bg-muted/30 text-muted-foreground line-through",
                          )}
                        >
                          {allowed ? (
                            <Check className="h-3 w-3 text-secondary" />
                          ) : (
                            <X className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="truncate">{a.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                  <p className="mb-1 flex items-center gap-1 font-semibold text-foreground">
                    <ShieldAlert className="h-3.5 w-3.5 text-secondary" /> Additive layer
                  </p>
                  <p>
                    RBAC is enforced at UI, API, database-query, and file-access layers.
                    Section visibility and action gating here are client-side filters; server-side
                    authorization checks run on every endpoint regardless. AI never marks a document
                    clinically final — only an authorized Provider can e-sign.
                  </p>
                </div>
              </motion.div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
