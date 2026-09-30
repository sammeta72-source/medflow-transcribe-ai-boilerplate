import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const COMMANDS = [
  { patterns: ["stat", "stat jobs", "show stat"], action: "navigate:jobs", filter: "priority=STAT", response: "Showing all STAT priority jobs. There are 2 STAT jobs in the pipeline, 1 at SLA breach risk." },
  { patterns: ["at risk", "sla risk", "risk"], action: "navigate:overview", filter: "slaRisk=at-risk", response: "Showing SLA at-risk jobs. 2 jobs are at risk, 1 has breached SLA." },
  { patterns: ["qa", "quality", "qa pass rate"], action: "navigate:quality", response: "QA pass rate is 84.7%. 3 jobs failed QA this week, 2 returned for rework." },
  { patterns: ["copilot", "summary", "backlog"], action: "navigate:copilot", response: "Generating predictive summary. 5 jobs in pipeline, 2 at risk, 1 breach. Recommend adding 1 editor for STAT queue." },
  { patterns: ["agents", "ai agents"], action: "navigate:agents", response: "10 AI agents running. All idle. Last run: Transcription Agent on JOB-2024-001, confidence 92%." },
  { patterns: ["escalate", "escalation"], action: "escalate", response: "Escalation triggered for JOB-2024-014. Operations manager notified." },
  { patterns: ["report", "client report", "generate report"], action: "generate_report", response: "Client operations report drafted for Cardinal Health Systems. 5 jobs in pipeline, 84.7% QA score, 87% SLA compliance." },
  { patterns: ["compliance", "controls", "audit"], action: "navigate:compliance", response: "Compliance posture: 81% coverage. 13 of 16 controls passing. 3 warnings on Zero Trust, SIEM, and HITRUST." },
  { patterns: ["billing", "invoice", "revenue"], action: "navigate:billing", response: "Billing: Professional plan, $499/mo + $420 usage overage = $919 total. 5 invoices paid this year." },
  { patterns: ["workforce", "team", "productivity"], action: "navigate:workforce", response: "Workforce: 6 active editors, productivity score 91%, 2 burnout-risk flags. Top performer: Priya Nair with 142 jobs completed." },
  { patterns: ["help", "what can you do"], action: "help", response: "I can navigate to any section, show STAT jobs, check SLA risk, generate reports, escalate jobs, check QA scores, and more. Just ask!" },
];
export async function POST(req: Request) {
  const { command } = await req.json();
  if (!command) return NextResponse.json({ error: "No command" }, { status: 400 });
  const lower = command.toLowerCase().trim();
  for (const cmd of COMMANDS) {
    if (cmd.patterns.some(p => lower.includes(p))) {
      return NextResponse.json({ ...cmd, recognized: true, original_command: command });
    }
  }
  return NextResponse.json({ action: "unknown", response: "I didn't understand that command. Try: 'show STAT jobs', 'SLA risk', 'QA pass rate', 'generate report', 'compliance', or 'help'.", recognized: false, original_command: command });
}
