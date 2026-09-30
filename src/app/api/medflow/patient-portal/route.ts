import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const deliveredJobs = await db.transcriptionJob.findMany({
    where: { status: "Delivered" },
    include: { provider: { select: { name: true, title: true } }, facility: { select: { name: true } }, specialty: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 20,
  });
  const clarifications = await db.clarificationRequest.findMany({ take: 5, orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    patient: { name: "John Doe (Synthetic)", mrn: "SYN-884721", dob: "1959-03-15", language: "en-US" },
    documents: deliveredJobs.map(j => ({
      jobNumber: j.jobNumber, date: j.createdAt, provider: j.provider?.name, facility: j.facility?.name,
      specialty: j.specialty?.name, docType: j.documentType, status: j.status,
      deliveryMethod: j.deliveryDest, downloadUrl: "#",
    })),
    consents: [
      { id: "c1", purpose: "Treatment", granted: true, date: "2026-01-15", withdrawable: true },
      { id: "c2", purpose: "Research (de-identified)", granted: false, date: null, withdrawable: true },
      { id: "c3", purpose: "Marketing communications", granted: false, date: null, withdrawable: true },
    ],
    messages: [
      { id: "m1", from: "Dr. Emily Carter", date: "2026-09-28", subject: "Follow-up on cardiology visit", unread: true },
      { id: "m2", from: "MedFlow Ops", date: "2026-09-25", subject: "Document delivered — SOAP note", unread: false },
    ],
    dsr_history: [
      { id: "d1", type: "access", date: "2026-06-10", status: "completed", sla: "met" },
      { id: "d2", type: "portability", date: "2026-03-22", status: "completed", sla: "met" },
    ],
    fhir_export_url: "/api/ai/fhir/patient-everything?XTransformPort=8000",
  });
}
