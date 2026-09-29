// Team members + skills + shifts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const users = await db.user.findMany({
    include: {
      memberships: { include: { organization: { select: { name: true, slug: true } } } },
      skills: { include: { specialty: { select: { name: true } } } },
      shifts: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      mfaEnabled: u.mfaEnabled,
      organization: u.memberships[0]?.organization.name ?? null,
      skills: u.skills.map(s => ({ specialty: s.specialty.name, proficiency: s.proficiency, certifications: s.certifications })),
      shifts: u.shifts.map(s => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
    })),
  });
}
