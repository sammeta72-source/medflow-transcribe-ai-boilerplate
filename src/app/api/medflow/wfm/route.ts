import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const users = await db.user.findMany({
    include: { skills: { include: { specialty: { select: { name: true } } } }, shifts: true, assignments: true },
    where: { role: { in: ["Transcriptionist", "Medical Editor", "QA Analyst"] } },
  });
  const leaderboard = users.map(u => ({
    id: u.id, name: u.name, role: u.role, avatar: u.name.split(" ").map(s => s[0]).slice(0,2).join(""),
    jobs_completed: u.assignments.length, quality_score: 80 + Math.floor(Math.random() * 20),
    avg_tat_hours: 3 + Math.random() * 8, rework_rate: Math.random() * 0.15,
    badges: ["CMT", "Top Performer"].slice(0, Math.floor(Math.random() * 2) + 1),
    streak_days: Math.floor(Math.random() * 30) + 1,
  })).sort((a, b) => b.jobs_completed - a.jobs_completed);
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const shifts = users.map(u => ({
    user_id: u.id, name: u.name, role: u.role,
    schedule: days.map(d => u.shifts.find(s => s.dayOfWeek === d) ? `${u.shifts.find(s => s.dayOfWeek === d)!.startTime}-${u.shifts.find(s => s.dayOfWeek === d)!.endTime}` : "—"),
  }));
  const skills = users.map(u => ({
    user_id: u.id, name: u.name, role: u.role,
    specialties: u.skills.map(s => ({ name: s.specialty.name, proficiency: s.proficiency, certifications: s.certifications })),
  }));
  return NextResponse.json({
    workforce_size: users.length, active_now: Math.floor(users.length * 0.6),
    on_shift: Math.floor(users.length * 0.6), productivity_score: 87 + Math.floor(Math.random() * 8),
    leaderboard, shifts, skills,
    stats: { total_jobs_today: 142, avg_tat_hours: 4.2, quality_avg: 84.7, rework_rate: 0.09, burnout_risk: 2 },
  });
}
