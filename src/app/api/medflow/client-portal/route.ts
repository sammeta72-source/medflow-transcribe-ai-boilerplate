// White-Labeled Client Portal config (E3) — returns mock portal configuration
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PORTAL_CONFIG = {
  portal_id: "cardinal-health-client-portal",
  tenant: "Cardinal Health Systems",
  branding: {
    portal_name: "Cardinal Health Transcription Portal",
    logo_url: "/medflow-logo.png",
    primary_color: "#0B5345",
    secondary_color: "#1ABC9C",
    accent_color: "#17202A",
    bg_color: "#E8F8F5",
    font_family: "Inter, system-ui, sans-serif",
  },
  domain: "portal.cardinalhealth.demo",
  status: "active",
  launched_at: "2026-07-15",
  allowed_job_types: ["SOAP Note", "Consultation Note", "H&P", "Discharge Summary", "Operative Report"],
  allowed_specialties: ["Cardiology", "Orthopedics", "Radiology", "Internal Medicine", "Surgery"],
  client_users: [
    { id: "cu1", name: "Dr. Emily Carter", email: "emily.carter@cardinalhealth.demo", role: "Provider", last_login: "2026-09-28T14:22:00Z", jobs_submitted: 142 },
    { id: "cu2", name: "Dr. James Okafor", email: "james.okafor@cardinalhealth.demo", role: "Provider", last_login: "2026-09-29T09:15:00Z", jobs_submitted: 98 },
    { id: "cu3", name: "Marcus Reyes", email: "marcus.reyes@cardinalhealth.demo", role: "Operations Manager", last_login: "2026-09-29T16:40:00Z", jobs_submitted: 0 },
    { id: "cu4", name: "Linda Hoffmann", email: "linda.hoffmann@cardinalhealth.demo", role: "Billing User", last_login: "2026-09-27T11:00:00Z", jobs_submitted: 0 },
  ],
  stats: {
    total_jobs_submitted: 824,
    total_jobs_delivered: 612,
    avg_tat_hours: 18.4,
    sla_compliance_pct: 87.3,
    quality_score_avg: 84.7,
    monthly_audio_minutes: 3745.5,
    current_month_usage_pct: 74.9,
  },
  features_enabled: {
    job_submission: true,
    job_tracking: true,
    document_download: true,
    fhir_export: true,
    sla_reports: true,
    invoice_download: true,
    clarifications: true,
    secure_messaging: true,
    bulk_upload: true,
    provider_feedback: true,
  },
  portal_preview_url: "/portal-preview",
  sso_enabled: true,
  sso_provider: "Azure AD (SAML 2.0)",
  custom_domain_verified: true,
  ssl_certificate: "DigiCert wildcard (*.cardinalhealth.demo)",
};

export async function GET() {
  return NextResponse.json(PORTAL_CONFIG);
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  // In a real app this would persist to DB; here we just echo back the updated config
  Object.assign(PORTAL_CONFIG, body, { updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true, config: PORTAL_CONFIG });
}
