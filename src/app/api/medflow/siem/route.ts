// SIEM Integration telemetry (G4) — returns mock SIEM posture + alert feed
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auditCount = await db.auditEvent.count();
  const alertCount = await db.securityAlert.count();

  const SIEM = {
    connection: {
      provider: "Splunk Enterprise Security (with Microsoft Sentinel failover)",
      status: "connected",
      endpoint: "splunk://hec-splunk.cardinalhealth.demo:8088",
      ingestion_method: "HTTP Event Collector (HEC) + Kafka topics",
      connected_at: "2026-08-01",
      last_handshake: new Date().toISOString(),
    },
    log_streaming: {
      events_streamed_last_24h: auditCount,
      events_streamed_last_7d: auditCount * 7,
      avg_ingest_latency_ms: 28,
      backpressure_events: 0,
      delivery_guarantee: "at-least-once (with dedup)",
    },
    dashboards: [
      { id: "hipaa-audit", name: "HIPAA Audit Trail", framework: "HIPAA", panels: 12, last_viewed: "2026-09-29" },
      { id: "gdpr-access", name: "GDPR PHI Access Patterns", framework: "GDPR", panels: 8, last_viewed: "2026-09-29" },
      { id: "21cfr11-sigs", name: "21 CFR Part 11 E-Signatures", framework: "21 CFR 11", panels: 6, last_viewed: "2026-09-28" },
      { id: "ueba-anomaly", name: "User + Entity Behavior Analytics", framework: "ISO 27001", panels: 9, last_viewed: "2026-09-29" },
      { id: "zero-trust", name: "Zero Trust Posture Monitor", framework: "NIST 800-207", panels: 7, last_viewed: "2026-09-29" },
    ],
    detection_rules: [
      {
        id: "bulk-download",
        name: "Bulk PHI Download (50+ docs / 10 min)",
        severity: "medium",
        status: "active",
        triggered_24h: 1,
        framework: "HIPAA + GDPR",
        mitre_attack: "T1041 (Exfiltration Over C2 Channel)",
      },
      {
        id: "impossible-travel",
        name: "Impossible Travel (login from 2 distant locations <1h)",
        severity: "high",
        status: "active",
        triggered_24h: 0,
        framework: "ISO 27001 A.8.16",
        mitre_attack: "T1078 (Valid Accounts)",
      },
      {
        id: "priv-escalation",
        name: "Privilege Escalation Attempt",
        severity: "high",
        status: "active",
        triggered_24h: 0,
        framework: "ISO 27001 A.5.15",
        mitre_attack: "T1068 (Exploitation for Privilege Escalation)",
      },
      {
        id: "off-hours-access",
        name: "Off-Hours PHI Access (outside 06:00-22:00)",
        severity: "low",
        status: "active",
        triggered_24h: 4,
        framework: "HIPAA 164.312(a)(1)",
        mitre_attack: "T1078",
      },
      {
        id: "failed-login-burst",
        name: "Failed Login Burst (5+ in 60s)",
        severity: "medium",
        status: "active",
        triggered_24h: 2,
        framework: "NIS2 Art. 21",
        mitre_attack: "T1110 (Brute Force)",
      },
    ],
    alert_feed: Array.from({ length: 5 }).map((_, i) => ({
      id: `alert-${i + 1}`,
      timestamp: new Date(Date.now() - i * 3600 * 1000).toISOString(),
      rule_id: ["bulk-download", "off-hours-access", "failed-login-burst", "impossible-travel", "priv-escalation"][i],
      severity: ["medium", "low", "medium", "high", "high"][i],
      status: ["open", "acknowledged", "resolved", "open", "acknowledged"][i],
      actor: "user u_ts2",
      detail: [
        "42 document downloads in 10 min",
        "PHI access at 02:14 local",
        "5 failed logins from 10.0.0.99",
        "Login NYC + London within 47min (impossible travel)",
        "Attempted role escalation: Transcriptionist → Medical Editor",
      ][i],
      siem_correlation_id: `siem-corr-${Date.now().toString(36)}-${i}`,
    })),
    retention: {
      hot_retention_days: 30,
      warm_retention_days: 90,
      cold_retention_years: 6,
      archival_target: "S3 Glacier Deep Archive",
      audit_log_retention_years: 6,
      mdr_retention_years: 10,
    },
    integrations: {
      ticketing: "ServiceNow (auto-ticket on high-severity)",
      pagerduty: "PagerDuty (on-call rotation for critical)",
      threat_intel: "AlienVault OTX + MISP feeds",
      vulnerability_scan: "Tenable + Qualys (weekly)",
    },
    coverage: {
      hipaa_controls_monitored: "37 of 54",
      iso_27001_controls_monitored: "81 of 93",
      hitrust_controls_monitored: "Inheritance + Validation ready",
      soc2_trust_categories: "5 of 5 (Security, Availability, Confidentiality, Processing Integrity, Privacy)",
    },
    alert_count: alertCount,
  };

  return NextResponse.json(SIEM);
}
