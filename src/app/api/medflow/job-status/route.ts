// Advance a job's workflow status (with audit event + optional assignment)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const NEXT_STATUS: Record<string, string> = {
  Draft: "Submitted",
  Submitted: "Intake validation",
  "Intake validation": "Awaiting Transcriptionist",
  "Awaiting Transcriptionist": "AI Transcription in progress",
  "AI Transcription in progress": "AI Draft Ready",
  "AI Draft Ready": "Editing in progress",
  "Editing in progress": "Awaiting QA",
  "Awaiting QA": "Awaiting Provider Review",
  "QA failed / rework": "Editing in progress",
  "Clarification requested": "AI Draft Ready",
  "Awaiting Provider Review": "Approved",
  Approved: "Delivered",
  Escalated: "Awaiting Provider Review",
};

export async function POST(req: Request) {
  const body = await req.json();
  const { jobId, action, actorName, status } = body;
  const job = await db.transcriptionJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  let newStatus = job.status;
  let eventDetail = action ?? "workflow advance";

  if (action === "advance") {
    newStatus = NEXT_STATUS[job.status] ?? job.status;
    eventDetail = `Advanced ${job.status} -> ${newStatus}`;
  } else if (action === "approve") {
    newStatus = "Approved";
    eventDetail = "Provider approval — electronic signature captured";
  } else if (action === "deliver") {
    newStatus = "Delivered";
    eventDetail = "Delivery Agent delivered via FHIR/HL7/portal";
  } else if (action === "escalate") {
    newStatus = "Escalated";
    eventDetail = "Escalated to Operations Manager — SLA breach";
  } else if (action === "rework") {
    newStatus = "QA failed / rework";
    eventDetail = "QA failed — routed to editor for rework";
  } else if (action === "clarify") {
    newStatus = "Clarification requested";
    eventDetail = "Clarification requested — SLA paused";
  } else if (action === "reject") {
    newStatus = "Rejected";
    eventDetail = "Provider rejected document";
  } else if (action === "set") {
    // Explicit status set via the `status` field (used by kanban drag-and-drop).
    if (typeof status === "string" && status.length > 0) {
      newStatus = status;
      eventDetail = `Kanban move ${job.status} -> ${newStatus}`;
    }
  }

  const updated = await db.transcriptionJob.update({
    where: { id: jobId },
    data: { status: newStatus as never, updatedAt: new Date() },
  });
  await db.jobEvent.create({
    data: {
      jobId,
      event: "status_changed",
      fromStatus: job.status,
      toStatus: newStatus,
      actorName: actorName ?? "System",
      detail: eventDetail,
      createdAt: new Date(),
    },
  });
  return NextResponse.json({ job: updated, newStatus });
}
