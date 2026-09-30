import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    auto_remediation_enabled: true,
    total_auto_fixed_30d: 23,
    pending_remediation: 2,
    remediation_log: [
      { id: "rm1", timestamp: new Date(Date.now()-3600000).toISOString(), control: "MFA not enabled for user u_ts3", severity: "medium", auto_action: "Enforced MFA enrollment + sent enrollment email", status: "completed", control_id: "hipaa.mfa" },
      { id: "rm2", timestamp: new Date(Date.now()-7200000).toISOString(), control: "Session idle timeout set to 30min (should be 15min)", severity: "low", auto_action: "Updated session timeout to 15min via policy engine", status: "completed", control_id: "hipaa.access-control" },
      { id: "rm3", timestamp: new Date(Date.now()-10800000).toISOString(), control: "Audit log gap detected (3 events missing hash-chain link)", severity: "high", auto_action: "Re-computed hash chain + flagged for review", status: "completed", control_id: "hipaa.audit-controls" },
      { id: "rm4", timestamp: new Date(Date.now()-86400000).toISOString(), control: "TLS 1.2 detected on /api/legacy endpoint", severity: "medium", auto_action: "Forced TLS 1.3 + deprecated TLS 1.2", status: "completed", control_id: "hipaa.encryption-transit" },
      { id: "rm5", timestamp: new Date(Date.now()-172800000).toISOString(), control: "Support access grant expired but not auto-revoked", severity: "high", auto_action: "Auto-revoked support access + notified compliance officer", status: "completed", control_id: "iso27001.isms" },
      { id: "rm6", timestamp: new Date(Date.now()-259200000).toISOString(), control: "Password policy not NIST 800-63B compliant (composition rules present)", severity: "low", auto_action: "Removed composition rules + enabled breach-corpus check", status: "completed", control_id: "hipaa.mfa" },
    ],
    pending: [
      { id: "rp1", control: "HITRUST inheritance at 47% (target: 60%)", severity: "medium", proposed_action: "Complete 13 inherited controls via HITRUST validation", auto_action: false, requires_human: true },
      { id: "rp2", control: "EU MDR PSUR not generated for Q3", severity: "medium", proposed_action: "Generate PSUR from PMS data", auto_action: false, requires_human: true },
    ],
  });
}
