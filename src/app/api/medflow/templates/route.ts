// Document templates library
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const templates = await db.documentTemplate.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    templates: templates.map(t => ({
      id: t.id,
      name: t.name,
      documentType: t.documentType,
      specialty: t.specialty,
      sections: JSON.parse(t.sectionsJson),
      versionNumber: t.versionNumber,
      status: t.status,
      updatedAt: t.updatedAt,
    })),
  });
}
