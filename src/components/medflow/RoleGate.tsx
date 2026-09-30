"use client";
// RoleGate — wraps children, only renders if the current role has the permission.
// Additive (Task 8) — used optionally by section components to hide action buttons.

import { type ReactNode } from "react";
import { useCan, type Permission } from "@/hooks/medflow/useRbac";

interface Props {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
  /** If true, render the fallback (default null) when permission is missing. */
  fallbackWhenDenied?: boolean;
}

export function RoleGate({ permission, children, fallback = null, fallbackWhenDenied = true }: Props) {
  const allowed = useCan(permission);
  if (allowed) return <>{children}</>;
  return fallbackWhenDenied ? <>{fallback}</> : <>{children}</>;
}
