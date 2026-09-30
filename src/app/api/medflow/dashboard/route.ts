// Dashboard aggregate metrics for the Overview + Analytics sections
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const jobs = await db.transcriptionJob.findMany();
  const total = jobs.length;
  const completed = jobs.filter(j => j.status === "Delivered").length;
  const inPipeline = jobs.filter(j => !["Delivered", "Rejected", "Cancelled"].includes(j.status)).length;
  const escalated = jobs.filter(j => j.status === "Escalated").length;
  const atRisk = jobs.filter(j => j.slaRiskLabel === "at-risk").length;
  const breach = jobs.filter(j => j.slaRiskLabel === "breach").length;
  const clarifications = jobs.filter(j => j.status === "Clarification requested").length;
  const rework = jobs.filter(j => j.status === "QA failed / rework").length;
  const stat = jobs.filter(j => j.priority === "STAT").length;
  const urgent = jobs.filter(j => j.priority === "Urgent").length;
  const avgQuality =
    jobs.filter(j => j.qualityScore != null).reduce((s, j) => s + (j.qualityScore ?? 0), 0) /
    Math.max(1, jobs.filter(j => j.qualityScore != null).length);
  const avgAiConf =
    jobs.filter(j => j.aiConfidence != null).reduce((s, j) => s + (j.aiConfidence ?? 0), 0) /
    Math.max(1, jobs.filter(j => j.aiConfidence != null).length);
  const audioMinutes = jobs.reduce((s, j) => s + (j.audioDurationSec ?? 0), 0) / 60;
  const tatCompliance = total ? (completed / total) * 100 : 0;

  // Status distribution
  const byStatus: Record<string, number> = {};
  for (const j of jobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;

  // Specialty distribution
  const specs = await db.specialty.findMany({ select: { id: true, name: true } });
  const specMap = new Map(specs.map(s => [s.id, s.name]));
  const bySpecialtyRaw: Record<string, number> = {};
  for (const j of jobs) {
    if (j.specialtyId) {
      const n = specMap.get(j.specialtyId) ?? "Unknown";
      bySpecialtyRaw[n] = (bySpecialtyRaw[n] ?? 0) + 1;
    }
  }

  // Volume trend (last 7 days, jobs created per day)
  const trend: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const count = jobs.filter(j => {
      const c = new Date(j.createdAt);
      return c >= d && c < next;
    }).length;
    trend.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), count });
  }

  // Recent audit events
  const auditEvents = await db.auditEvent.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });

  // Notifications (unread)
  const notifications = await db.notification.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
  });
  const unreadNotifs = notifications.filter(n => !n.readAt).length;

  // Security alerts
  const securityAlerts = await db.securityAlert.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  // Integrations
  const integrations = await db.integrationConnection.findMany();

  // Delivery destinations
  const deliveryDestinations = await db.deliveryDestination.findMany();

  // Subscription
  const subscription = await db.subscription.findFirst();
  // Usage
  const usage = await db.usageRecord.findFirst({ orderBy: { createdAt: "desc" } });

  return NextResponse.json({
    metrics: {
      total,
      completed,
      inPipeline,
      escalated,
      atRisk,
      breach,
      clarifications,
      rework,
      stat,
      urgent,
      avgQuality: Math.round(avgQuality * 10) / 10,
      avgAiConf: Math.round(avgAiConf * 100) / 100,
      audioMinutes: Math.round(audioMinutes * 10) / 10,
      tatCompliance: Math.round(tatCompliance * 10) / 10,
    },
    byStatus,
    bySpecialty: bySpecialtyRaw,
    trend,
    auditEvents: auditEvents.map(a => ({
      id: a.id,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      severity: a.severity,
      actorName: a.actor?.name ?? null,
      ip: a.ip,
      detail: a.metadataJson ? JSON.parse(a.metadataJson).detail : null,
      createdAt: a.createdAt,
    })),
    notifications: notifications.map(n => ({ ...n })),
    unreadNotifs,
    securityAlerts: securityAlerts.map(s => ({ ...s })),
    integrations: integrations.map(i => ({ ...i })),
    deliveryDestinations: deliveryDestinations.map(d => ({ ...d })),
    subscription: subscription ? { ...subscription } : null,
    usage: usage ? { ...usage } : null,
  });
}
