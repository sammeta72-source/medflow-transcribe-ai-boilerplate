import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    soc_status: "active",
    autonomy_level: "full_response",
    agents_active: 3,
    threats_detected_24h: 7,
    auto_responses_24h: 7,
    mean_time_to_respond_ms: 142,
    threat_feed: [
      { id: "t1", timestamp: new Date(Date.now()-3600000).toISOString(), type: "bulk_download", severity: "high", source: "user u_ts2", detail: "52 document downloads in 8 min", auto_response: "session_revoked", response_time_ms: 142, status: "contained" },
      { id: "t2", timestamp: new Date(Date.now()-7200000).toISOString(), type: "impossible_travel", severity: "medium", source: "user u_qa2", detail: "Login from NYC + London within 47min", auto_response: "mfa_challenge", response_time_ms: 89, status: "resolved" },
      { id: "t3", timestamp: new Date(Date.now()-10800000).toISOString(), type: "privilege_escalation", severity: "critical", source: "user u_ts3", detail: "Attempted role escalation: Transcriptionist → Admin", auto_response: "access_restricted", response_time_ms: 67, status: "investigating" },
      { id: "t4", timestamp: new Date(Date.now()-14400000).toISOString(), type: "failed_login_burst", severity: "medium", source: "IP 10.0.0.99", detail: "12 failed logins in 60s", auto_response: "ip_blocked", response_time_ms: 23, status: "resolved" },
      { id: "t5", timestamp: new Date(Date.now()-18000000).toISOString(), type: "off_hours_access", severity: "low", source: "user u_ed1", detail: "PHI access at 02:14 local", auto_response: "monitoring", response_time_ms: 0, status: "monitoring" },
    ],
    response_playbooks: [
      { id: "pb1", name: "Bulk Download Response", trigger: "bulk_download", actions: ["session_revoke", "user_quarantine", "security_officer_notify", "audit_flag"], auto_execute: true },
      { id: "pb2", name: "Impossible Travel Response", trigger: "impossible_travel", actions: ["mfa_challenge", "session_monitor", "geo_log"], auto_execute: true },
      { id: "pb3", name: "Privilege Escalation Response", trigger: "privilege_escalation", actions: ["access_restrict", "session_record", "ir_team_notify", "forensic_snapshot"], auto_execute: true },
      { id: "pb4", name: "Brute Force Response", trigger: "failed_login_burst", actions: ["ip_block", "account_lock_5min", "rate_limit_increase"], auto_execute: true },
    ],
    coverage: { threats_auto_responded: "100%", mean_time_to_respond: "142ms (vs 4hr human)", false_positive_rate: "3.2%" },
  });
}
