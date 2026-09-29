// Mobile Provider App config (F2) — returns mock mobile app configuration + telemetry
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MOBILE_CONFIG = {
  app_id: "medflow-provider-mobile",
  version: "1.4.2",
  status: "in_production",
  platforms: {
    ios: {
      version: "1.4.2",
      min_ios: "15.0",
      app_store_url: "https://apps.apple.com/app/medflow-transcribe/id1547XXXXXX",
      status: "approved",
      last_release: "2026-09-15",
      rating: 4.8,
      rating_count: 1247,
    },
    android: {
      version: "1.4.2",
      min_android: "8.0",
      play_store_url: "https://play.google.com/store/apps/details?id=com.medflow.provider",
      status: "approved",
      last_release: "2026-09-15",
      rating: 4.7,
      rating_count: 892,
    },
  },
  features: {
    biometric_auth: true,
    offline_mode: true,
    push_notifications: true,
    apple_health_sync: true,
    google_fit_sync: true,
    voice_dictation: true,
    photo_document_capture: true,
    secure_messaging: true,
    document_review: true,
    e_signature: true,
    fhir_export: true,
  },
  security: {
    biometric_lock: true,
    certificate_pinning: true,
    jailbreak_detection: true,
    root_detection: true,
    code_obfuscation: true,
    secure_keystore: true,
    min_session_timeout_min: 15,
    screenshot_blocking: true,
  },
  qr_download_url: "/medflow-mobile-qr",
  deep_link_scheme: "medflow://",
  universal_link: "https://app.medflow.demo/open",
  push_notification_config: {
    provider: "FCM + APNs",
    encryption: "ECDH (end-to-end)",
    critical_alerts: true,
    quiet_hours_default: "22:00-07:00 local",
  },
  usage_stats: {
    active_installations: 342,
    monthly_active_users: 287,
    avg_session_min: 4.2,
    crashes_last_7d: 3,
    crash_free_users_pct: 99.1,
    top_feature_used: "Voice dictation",
    offline_sync_count_last_30d: 142,
  },
  rollout: {
    current_release_pct: 100,
    staged_rollout_enabled: true,
    next_version_in_review: "1.5.0",
    next_version_features: ["Live transcription streaming", "Multi-language support", "Apple Watch dictation"],
  },
};

export async function GET() {
  return NextResponse.json(MOBILE_CONFIG);
}
