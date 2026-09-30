import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const SRA_QUESTIONS = [
  { id: "ac1", category: "Access Control", citation: "45 CFR 164.312(a)(1)", question: "Does the system assign a unique user ID to every workforce member?", guidance: "Each user must have a unique identifier for accountability." },
  { id: "ac2", category: "Access Control", citation: "45 CFR 164.312(a)(2)(iii)", question: "Does the system auto-logoff after a period of inactivity?", guidance: "Automatic logoff prevents unauthorized access to unattended sessions." },
  { id: "ac3", category: "Access Control", citation: "45 CFR 164.312(a)(2)(i)", question: "Is emergency access (break-glass) procedure documented + tested?", guidance: "Break-glass access must be logged, time-boxed, and reviewed." },
  { id: "au1", category: "Audit Controls", citation: "45 CFR 164.312(b)", question: "Does the system record + examine activity in systems containing ePHI?", guidance: "Audit logs must capture who, what, when, where for every PHI access." },
  { id: "au2", category: "Audit Controls", citation: "45 CFR 164.308(a)(1)(ii)(c)", question: "Are audit logs retained for at least 6 years?", guidance: "HIPAA requires 6-year retention; EU MDR requires 10+." },
  { id: "in1", category: "Integrity", citation: "45 CFR 164.312(c)(1)", question: "Does the system protect ePHI from improper alteration or destruction?", guidance: "Hash-chaining or WORM storage ensures immutability." },
  { id: "tr1", category: "Transmission Security", citation: "45 CFR 164.312(e)(1)", question: "Is ePHI encrypted during transmission (TLS 1.2+)?", guidance: "TLS 1.3 recommended; no fallback to plaintext." },
  { id: "tr2", category: "Transmission Security", citation: "45 CFR 164.312(e)(2)(ii)", question: "Are integrity controls (checksums/hash) applied to transmitted ePHI?", guidance: "End-to-end integrity verification prevents tampering in transit." },
  { id: "or1", category: "Organizational", citation: "45 CFR 164.314(a)", question: "Is a BAA executed with every business associate?", guidance: "A signed BAA is required for every vendor with PHI access." },
  { id: "or2", category: "Organizational", citation: "45 CFR 164.308(a)(1)", question: "Is a documented risk analysis conducted at least annually?", guidance: "The SRA is the foundational HIPAA requirement — OCR's #1 audit finding." },
  { id: "pp1", category: "Policies & Procedures", citation: "45 CFR 164.316", question: "Are security policies documented, approved, and reviewed annually?", guidance: "Policies must be in writing, communicated to workforce, and updated." },
  { id: "pp2", category: "Policies & Procedures", citation: "45 CFR 164.308(a)(5)", question: "Is workforce security awareness + training conducted annually?", guidance: "Every workforce member must complete HIPAA security training." },
];
export async function GET() {
  return NextResponse.json({ questions: SRA_QUESTIONS, total: SRA_QUESTIONS.length, categories: [...new Set(SRA_QUESTIONS.map(q => q.category))] });
}
export async function POST(req: Request) {
  const { answers } = await req.json();
  const results = SRA_QUESTIONS.map(q => {
    const a = answers?.[q.id] ?? "not_implemented";
    const risk = a === "implemented" ? 0 : a === "partially" ? 0.5 : 1;
    return { ...q, answer: a, risk_score: risk };
  });
  const totalRisk = results.reduce((s, r) => s + r.risk_score, 0) / results.length;
  return NextResponse.json({
    results,
    overall_risk_score: Math.round(totalRisk * 100) / 100,
    risk_level: totalRisk < 0.2 ? "low" : totalRisk < 0.5 ? "moderate" : totalRisk < 0.8 ? "high" : "critical",
    remediation_items: results.filter(r => r.answer !== "implemented").map(r => ({ id: r.id, question: r.question, citation: r.citation, current: r.answer, recommended_action: r.answer === "not_implemented" ? "Implement this control" : "Complete partial implementation", priority: r.risk_score === 1 ? "high" : "medium" })),
    completed_at: new Date().toISOString(),
    next_review: new Date(Date.now() + 365 * 86400000).toISOString(),
  });
}
