// Upload dictation endpoint — accepts form data + creates the job
// (The actual audio file is simulated; we record metadata only.)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const count = await db.transcriptionJob.count();
  const jobNumber = `JOB-2024-${String(count + 16).padStart(3, "0")}`;
  const now = new Date();
  const slaHours = body.priority === "STAT" ? 4 : body.priority === "Urgent" ? 12 : 24;
  const slaDeadline = new Date(now.getTime() + slaHours * 3600 * 1000);

  const org = await db.organization.findFirst();
  if (!org) return NextResponse.json({ error: "no org" }, { status: 500 });

  const job = await db.transcriptionJob.create({
    data: {
      jobNumber,
      organizationId: org.id,
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
