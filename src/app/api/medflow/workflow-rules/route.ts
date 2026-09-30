import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
let RULES = [
  { id: "r1", name: "STAT auto-escalate", enabled: true, priority: 1, conditions: [{ field: "priority", op: "=", value: "STAT" }], actions: [{ type: "escalate", target: "ops_manager" }] },
  { id: "r2", name: "Cardiology → Cardiology team", enabled: true, priority: 2, conditions: [{ field: "specialty", op: "=", value: "Cardiology" }], actions: [{ type: "assign_team", target: "cardiology_team" }] },
  { id: "r3", name: "High-confidence skip editor", enabled: true, priority: 3, conditions: [{ field: "ai_confidence", op: ">=", value: 0.95 }], actions: [{ type: "skip_to", target: "qa" }] },
  { id: "r4", name: "Low-confidence → senior editor", enabled: true, priority: 4, conditions: [{ field: "ai_confidence", op: "<", value: 0.80 }], actions: [{ type: "assign_role", target: "senior_editor" }] },
  { id: "r5", name: "Off-hours STAT → on-call", enabled: false, priority: 5, conditions: [{ field: "priority", op: "=", value: "STAT" }, { field: "time_of_day", op: "in", value: "off_hours" }], actions: [{ type: "assign_oncall" }] },
];
export async function GET() { return NextResponse.json({ rules: RULES, total: RULES.length }); }
export async function POST(req: Request) {
  const body = await req.json();
  const newRule = { ...body, id: `r${Date.now().toString(36)}`, enabled: true };
  RULES = [newRule, ...RULES];
  return NextResponse.json({ ok: true, rule: newRule, rules: RULES });
}
export async function DELETE(req: Request) {
  const { id } = await req.json();
  RULES = RULES.filter(r => r.id !== id);
  return NextResponse.json({ ok: true, rules: RULES });
}
