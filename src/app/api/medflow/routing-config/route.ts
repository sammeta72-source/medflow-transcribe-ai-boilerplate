import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
let CONFIG = {
  high_confidence_threshold: 0.95,
  low_confidence_threshold: 0.80,
  high_confidence_action: "skip_editor_to_qa",
  low_confidence_action: "route_to_senior_editor",
  default_assignment: "round_robin",
  fairness_window: "weekly",
  escalation_threshold_min: 30,
  auto_assign_enabled: true,
};
export async function GET() { return NextResponse.json(CONFIG); }
export async function POST(req: Request) {
  const body = await req.json();
  CONFIG = { ...CONFIG, ...body, updated_at: new Date().toISOString() };
  return NextResponse.json({ ok: true, config: CONFIG });
}
