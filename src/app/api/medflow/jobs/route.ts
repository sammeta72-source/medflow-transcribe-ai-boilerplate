// MedFlow Transcribe AI — API route for listing jobs (with relations)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const jobs = await db.transcriptionJob.findMany({
    include: {
      provider: { select: { id: true, name: true, title: true } },
      facility: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true } },
      specialty: { select: { id: true, name: true } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      qualityReviews: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  const assignedIds = [...new Set(jobs.map(j => j.assignedToId).filter(Boolean) as string[])];
  const users = assignedIds.length
    ? await db.user.findMany({ where: { id: { in: assignedIds } }, select: { id: true, name: true, role: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));
  const enriched = jobs.map(j => ({
    ...j,
    assignedTo: j.assignedToId ? userMap.get(j.assignedToId) ?? null : null,
  }));
  return NextResponse.json({ jobs: enriched });
}

// Create a new job (from Upload Dictation form) — triggers the full agent pipeline via FastAPI
export async function POST(req: Request) {
  const body = await req.json();
  // Compute job number
  const count = await db.transcriptionJob.count();
  const jobNumber = `JOB-2024-${String(count + 16).padStart(3, "0")}`;
  const now = new Date();
  const slaHours = body.priority === "STAT" ? 4 : body.priority === "Urgent" ? 12 : 24;
  const slaDeadline = new Date(now.getTime() + slaHours * 3600 * 1000);
  const job = await db.transcriptionJob.create({
    data: {
      jobNumber,
      organizationId: body.organizationId,
      status: "Submitted",
      priority: body.priority ?? "Routine",
      patientRef: body.patientRef ?? null,
      encounterRef: body.encounterRef ?? null,
      providerId: body.providerId ?? null,
      facilityId: body.facilityId ?? null,
      departmentId: body.departmentId ?? null,
      specialtyId: body.specialtyId ?? null,
      templateId: body.templateId ?? null,
      documentType: body.documentType ?? "SOAP Note",
      audioFileName: body.audioFileName ?? "dictation_upload.wav",
      audioDurationSec: body.audioDurationSec ?? 180,
      audioSizeBytes: body.audioSizeBytes ?? 2_880_000,
      slaDeadline,
      slaPercent: 0,
      slaRiskLabel: "on-track",
      deliveryDest: body.deliveryDest ?? null,
      clientInstructions: body.clientInstructions ?? null,
    },
  });
  // Seed initial job event
  await db.jobEvent.create({
    data: {
      jobId: job.id,
      event: "status_changed",
      fromStatus: null,
      toStatus: "Submitted",
      actorName: body.providerName ?? "Provider",
      detail: `Dictation uploaded — ${body.audioFileName ?? "file"} (${body.audioDurationSec ?? 180}s)`,
      createdAt: now,
    },
  });
  return NextResponse.json({ job });
}
