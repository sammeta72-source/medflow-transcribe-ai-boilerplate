// Returns dropdown options for the Upload Dictation form (providers, facilities, departments, specialties, templates)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [providers, facilities, departments, specialties, templates] = await Promise.all([
    db.provider.findMany({ select: { id: true, name: true, title: true } }),
    db.facility.findMany({ select: { id: true, name: true, code: true } }),
    db.department.findMany({ select: { id: true, name: true } }),
    db.specialty.findMany({ select: { id: true, name: true } }),
    db.documentTemplate.findMany({ select: { id: true, name: true, documentType: true } }),
  ]);
  return NextResponse.json({ providers, facilities, departments, specialties, templates });
}
