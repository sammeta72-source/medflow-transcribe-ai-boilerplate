import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    models: [
      { id: "whisper-large-v3", name: "Transcription (whisper-large-v3)", version: "v2.4.1", accuracy: 0.924, precision: 0.931, recall: 0.918, drift_detected: false, drift_score: 0.03, last_trained: "2026-09-15", next_review: "2026-12-15", status: "healthy", retraining_pipeline: null },
      { id: "glm-4-structuring", name: "Document Structuring (glm-4-longcontext)", version: "v1.2.0", accuracy: 0.891, precision: 0.903, recall: 0.879, drift_detected: false, drift_score: 0.05, last_trained: "2026-09-10", next_review: "2026-12-10", status: "healthy", retraining_pipeline: null },
      { id: "glm-4-qa", name: "QA Agent (glm-4-longcontext)", version: "v1.1.0", accuracy: 0.867, precision: 0.881, recall: 0.854, drift_detected: true, drift_score: 0.12, last_trained: "2026-08-20", next_review: "2026-11-20", status: "drift_detected", retraining_pipeline: { stage: "training", progress: 0.45, eta: "2h 15m", data_points: 4521, epochs: 3, current_epoch: 2, validation_accuracy: 0.889 } },
      { id: "rule-engine-routing", name: "Routing Engine (rule-based)", version: "v1.0.2", accuracy: 0.948, drift_detected: false, status: "healthy" },
      { id: "medflow-cnl-v1", name: "Entity Extraction (medflow-cnl)", version: "v1.0.0", accuracy: 0.873, drift_detected: false, drift_score: 0.04, status: "healthy" },
    ],
    auto_retraining_enabled: true,
    drift_threshold: 0.10,
    retraining_history: [
      { model: "qa-agent", date: "2026-08-20", trigger: "drift_score=0.11", before_accuracy: 0.845, after_accuracy: 0.867, duration: "3h 42m", status: "deployed" },
      { model: "transcription", date: "2026-09-15", trigger: "scheduled_quarterly", before_accuracy: 0.918, after_accuracy: 0.924, duration: "5h 12m", status: "deployed" },
      { model: "structuring", date: "2026-09-10", trigger: "scheduled_quarterly", before_accuracy: 0.885, after_accuracy: 0.891, duration: "4h 30m", status: "deployed" },
    ],
    pipeline_stages: ["data_prep", "train", "evaluate", "deploy", "monitor"],
    next_scheduled_review: "2026-12-10",
  });
}
