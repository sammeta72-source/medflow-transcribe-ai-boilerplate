// Audit events + security alerts + data retention policy
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [auditEvents, securityAlerts, retention, notifications] = await Promise.all([
    db.auditEvent.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true, email: true, role: true } } },
    }),
    db.securityAlert.findMany({ take: 30, orderBy: { createdAt: "desc" } }),
    db.dataRetentionPolicy.findFirst(),
    db.notification.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({
    auditEvents: auditEvents.map(a => ({
      id: a.id,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      severity: a.severity,
      actorName: a.actor?.name ?? null,
      actorEmail: a.actor?.email ?? null,
      actorRole: a.actor?.role ?? null,
      ip: a.ip,
      userAgent: a.userAgent,
      detail: a.metadataJson ? (JSON.parse(a.metadataJson).detail ?? null) : null,
      createdAt: a.createdAt,
    })),
    securityAlerts: securityAlerts.map(s => ({ ...s })),
    retention: retention ?? null,
    notifications: notifications.map(n => ({ ...n })),
  });
}
