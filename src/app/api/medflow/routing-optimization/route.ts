import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    optimization_enabled: true,
    last_optimization: "2026-09-29T22:00:00Z",
    next_optimization: "2026-10-06T22:00:00Z",
    cadence: "weekly",
    editor_performance: [
      { editor: "Priya Nair", role: "Transcriptionist", specialty: "Cardiology", jobs: 142, avg_qa: 94, avg_tat_h: 3.2, rework_rate: 0.04, trend: "improving", recommended_weight: 1.3 },
      { editor: "Diego Martinez", role: "Transcriptionist", specialty: "Orthopedics", jobs: 98, avg_qa: 91, avg_tat_h: 4.1, rework_rate: 0.06, trend: "stable", recommended_weight: 1.1 },
      { editor: "Sara Lin", role: "Medical Editor", specialty: "Radiology", jobs: 76, avg_qa: 93, avg_tat_h: 2.8, rework_rate: 0.03, trend: "improving", recommended_weight: 1.4 },
      { editor: "Tom Becker", role: "Medical Editor", specialty: "Surgery", jobs: 54, avg_qa: 87, avg_tat_h: 5.2, rework_rate: 0.11, trend: "declining", recommended_weight: 0.8 },
    ],
    auto_adjustments: [
      { date: "2026-09-29", adjustment: "Increased Priya Nair's routing weight from 1.2 to 1.3 (best QA + lowest rework in cardiology)", impact: "Expected 8% TAT improvement for cardiology jobs", auto_applied: true },
      { date: "2026-09-29", adjustment: "Decreased Tom Becker's routing weight from 1.0 to 0.8 (rework rate 11% > 8% threshold)", impact: "Expected 15% rework reduction for surgery jobs", auto_applied: true },
      { date: "2026-09-29", adjustment: "Detected: cardiology + Dr. Carter → best QA match (94 avg). Auto-routing all Carter jobs to cardiology team.", impact: "Expected 5% QA improvement", auto_applied: true },
      { date: "2026-09-22", adjustment: "Detected: Whisper model accuracy higher on clean audio (>0.95 confidence). Auto-routing high-confidence drafts to skip-editor flow.", impact: "Expected 40% TAT improvement on easy jobs", auto_applied: true },
    ],
    before_after: { avg_tat_before: 6.8, avg_tat_after: 4.2, improvement_pct: 38, rework_before: 0.12, rework_after: 0.09, improvement_pct: 25, qa_before: 82.1, qa_after: 84.7, improvement_pct: 3.2 },
    learning_metrics: { training_data_points: 824, features_used: 14, model: "gradient-boosted-trees", validation_accuracy: 0.91 },
  });
}
