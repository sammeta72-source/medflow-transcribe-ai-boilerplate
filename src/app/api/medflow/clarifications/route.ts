// Clarifications (open + recent)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const clarifications = await db.clarificationRequest.findMany({
    include: {
      job: { select: { jobNumber: true, patientRef: true, documentType: true } },
      creator: { select: { name: true } },
      messages: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({
    clarifications: clarifications.map(c => ({
      id: c.id,
      jobId: c.jobId,
      jobNumber: c.job.jobNumber,
      patientRef: c.job.patientRef,
      documentType: c.job.documentType,
      requestType: c.requestType,
      severity: c.severity,
      question: c.question,
      status: c.status,
      slaPausedAt: c.slaPausedAt,
      resolvedAt: c.resolvedAt,
      creator: c.creator?.name ?? null,
      createdAt: c.createdAt,
      messages: c.messages.map(m => ({
        id: m.id,
        body: m.body,
        author: m.author?.name ?? "System",
        isInternal: m.isInternal,
        createdAt: m.createdAt,
      })),
    })),
  });
}
