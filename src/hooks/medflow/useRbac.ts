"use client";
// MedFlow RBAC client store + hook (additive — Task 8).
// Components opt in via useRbac(); nothing else changes.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type Permission,
  type Role,
  ROLE_PERMISSIONS,
  SECTION_PERMISSIONS,
  roleHasPermission,
  DEMO_ROLE_PRESETS,
} from "@/lib/medflow/rbac";

interface RbacState {
  role: Role;
  userName: string;
  userEmail: string;
  setRole: (role: Role) => void;
  setPersona: (p: { role: Role; name: string; email: string }) => void;
  can: (perm: Permission) => boolean;
  canAccessSection: (sectionId: string) => boolean;
  reset: () => void;
}

const DEFAULT_PERSONA = DEMO_ROLE_PRESETS[0]; // Tenant Owner — Dana Whitfield

export const useRbac = create<RbacState>()(
  persist(
    (set, get) => ({
      role: DEFAULT_PERSONA.role,
      userName: DEFAULT_PERSONA.name,
      userEmail: DEFAULT_PERSONA.email,
      setRole: (role) => {
        const preset = DEMO_ROLE_PRESETS.find((p) => p.role === role);
        set({
          role,
          userName: preset?.name ?? role,
          userEmail: preset?.email ?? "",
        });
      },
      setPersona: (p) =>
        set({ role: p.role, userName: p.name, userEmail: p.email }),
      can: (perm) => roleHasPermission(get().role, perm),
      canAccessSection: (sectionId) => {
        const perm = SECTION_PERMISSIONS[sectionId];
        if (!perm) return true; // unknown section — allow by default
        return roleHasPermission(get().role, perm);
      },
      reset: () =>
        set({
          role: DEFAULT_PERSONA.role,
          userName: DEFAULT_PERSONA.name,
          userEmail: DEFAULT_PERSONA.email,
        }),
    }),
    {
      name: "medflow.rbac.v1",
      // Only persist the persona fields, not the functions.
      partialize: (s) => ({
        role: s.role,
        userName: s.userName,
        userEmail: s.userEmail,
      }),
    },
  ),
);

// Selector helpers (avoid re-render storms)
export function useCan(perm: Permission): boolean {
  return useRbac((s) => s.can(perm));
}

export function useCanAccessSection(sectionId: string): boolean {
  return useRbac((s) => s.canAccessSection(sectionId));
}

export function useCurrentUser() {
  return useRbac((s) => ({
    name: s.userName,
    role: s.role,
    email: s.userEmail,
  }));
}

// Server-side / non-hook helper for components that can't use hooks.
export function canStatic(role: Role, perm: Permission): boolean {
  return roleHasPermission(role, perm);
}

// All permissions list (for the Roles panel matrix)
export function permissionListForRole(role: Role): Permission[] {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  if (perms.includes("*")) {
    // Super admin — return all known permissions
    return Object.values(SECTION_PERMISSIONS).concat([
      "action.upload_dictation","action.assign","action.reassign","action.advance_workflow",
      "action.run_ai_agent","action.request_clarification","action.resolve_clarification",
      "action.qa_review","action.qa_reject","action.provider_approve","action.provider_sign",
      "action.deliver","action.escalate","action.cancel_job","action.edit_template",
      "action.manage_users","action.manage_integrations","action.manage_billing",
      "action.view_audit","action.export_data","action.delete_tenant",
    ]);
  }
  return perms;
}
