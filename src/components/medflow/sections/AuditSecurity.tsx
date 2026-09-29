"use client";
// MedFlow — Audit & Security (audit trail, alerts, retention, notifications).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertOctagon, Bell, CheckCircle2, Clock, FileText, Filter, KeyRound,
  Network, Pause, RefreshCw, ServerCog, ShieldAlert, ShieldCheck,
  Trash2, Unlock, Activity, Eye,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatDateTime, formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

interface AuditEvent {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  severity: "info" | "warning" | "critical";
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  ip: string | null;
  detail: string | null;
  createdAt: string;
}
interface SecurityAlert {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  detail: string;
  status: "open" | "acknowledged" | "resolved";
  createdAt: string;
}
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  recipient: string | null;
  role: string | null;
  createdAt: string;
}
interface AuditData {
  auditEvents: AuditEvent[];
  securityAlerts: SecurityAlert[];
  retention: {
    audioRetentionDays: number;
    documentRetentionDays: number;
    auditRetentionDays: number;
    legalHoldsEnabled: boolean;
    secureDeletion: boolean;
  } | null;
  notifications: Notification[];
}

const SEV_DOT: Record<string, string> = {
  info: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};
const SEV_BADGE: Record<string, string> = {
  info: "bg-emerald-100 text-emerald-700 border-emerald-300",
  warning: "bg-amber-100 text-amber-700 border-amber-300",
  critical: "bg-red-100 text-red-700 border-red-300",
};

export function AuditSecurity() {
  const { data, loading, error, refresh } = useFetch<AuditData>("/api/medflow/audit");
  const [actionFilter, setActionFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");
  const [search, setSearch] = useState("");

  const events = useMemo(() => {
    if (!data?.auditEvents) return [];
    return data.auditEvents
      .filter(e => actionFilter === "all" || e.action === actionFilter)
      .filter(e => sevFilter === "all" || e.severity === sevFilter)
      .filter(e => !search || (e.detail ?? "").toLowerCase().includes(search.toLowerCase()) || (e.actorName ?? "").toLowerCase().includes(search.toLowerCase()));
  }, [data, actionFilter, sevFilter, search]);

  const actions = Array.from(new Set(data?.auditEvents.map(e => e.action) ?? []));

  if (loading) return (
    <div>
      <PageHeader title="Audit & Security" description="Audit trail, security alerts, retention policy, and notifications." icon={ShieldAlert} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Audit & Security" description="Audit trail, security alerts, retention policy, and notifications." icon={ShieldAlert} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  async function markRead(id: string) {
    try {
      await fetch("/api/medflow/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      toast.success("Marked as read");
      refresh();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    }
  }

  return (
    <div>
      <PageHeader
        title="Audit & Security"
        description="Immutable audit trail, security alerts, data retention policy, and notifications."
        icon={ShieldAlert}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* Compliance disclaimer */}
      <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Compliance disclaimer</AlertTitle>
        <AlertDescription>
          Customers are responsible for their own regulatory obligations. MedFlow provides technical and administrative controls (audit logging, MFA enforcement, retention policies, encryption in transit and at rest) and supporting documentation. This is not legal advice.
        </AlertDescription>
      </Alert>

        <Tabs defaultValue="audit">
        <TabsList className="mb-4">
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
          <TabsTrigger value="retention">Data Retention</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="zero-trust">Zero Trust</TabsTrigger>
          <TabsTrigger value="siem">SIEM</TabsTrigger>
        </TabsList>

        {/* ── Audit trail ──────────────────────────── */}
        <TabsContent value="audit">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-9 w-44 text-xs">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sevFilter} onValueChange={setSevFilter}>
                <SelectTrigger className="h-9 w-32 text-xs">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Search detail / actor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 max-w-xs text-xs"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {events.length === 0 ? (
                <EmptyState icon={FileText} message="No audit events match filters." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px]">When</TableHead>
                      <TableHead className="text-[11px]">Action</TableHead>
                      <TableHead className="text-[11px]">Actor</TableHead>
                      <TableHead className="text-[11px]">Resource</TableHead>
                      <TableHead className="text-[11px]">Severity</TableHead>
                      <TableHead className="text-[11px]">IP</TableHead>
                      <TableHead className="text-[11px]">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.slice(0, 25).map((e, i) => (
                      <motion.tr
                        key={e.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        className="hover:bg-muted/40"
                      >
                        <TableCell className="text-[10px] text-muted-foreground">{formatRelative(e.createdAt)}</TableCell>
                        <TableCell className="font-mono text-[11px] font-semibold">{e.action}</TableCell>
                        <TableCell className="text-[11px]">
                          <p className="font-semibold text-foreground">{e.actorName ?? "System"}</p>
                          <p className="text-[10px] text-muted-foreground">{e.actorRole}</p>
                        </TableCell>
                        <TableCell className="text-[10px] font-mono text-muted-foreground">{e.resourceType ?? "—"}/{e.resourceId?.slice(0, 8)}</TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", SEV_BADGE[e.severity])}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", SEV_DOT[e.severity])} /> {e.severity}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-[10px]">{e.ip ?? "—"}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{e.detail ?? "—"}</TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Showing {Math.min(25, events.length)} of {events.length} filtered events · {data.auditEvents.length} total
          </p>
        </TabsContent>

        {/* ── Security alerts ──────────────────────── */}
        <TabsContent value="alerts">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.securityAlerts.length === 0 ? (
              <Card className="md:col-span-2"><CardContent><EmptyState icon={CheckCircle2} message="No security alerts." /></CardContent></Card>
            ) : (
              data.securityAlerts.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600">
                            <AlertOctagon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-[12px] font-semibold text-foreground">{a.type}</p>
                            <p className="text-[11px] text-muted-foreground">{a.detail}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {formatRelative(a.createdAt)} · severity {a.severity}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]",
                            a.status === "open" ? "text-red-700 border-red-300 bg-red-50"
                            : a.status === "acknowledged" ? "text-amber-700 border-amber-300 bg-amber-50"
                            : "text-emerald-700 border-emerald-300 bg-emerald-50",
                          )}
                        >
                          {a.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => toast.info("Alert acknowledged")}>
                          <Unlock className="mr-1 h-3 w-3" /> Acknowledge
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toast.success("Alert resolved")}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Data retention ───────────────────────── */}
        <TabsContent value="retention">
          {data.retention ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-secondary" /> Retention policy
                  </CardTitle>
                  <CardDescription className="text-xs">Per-data-class retention windows</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <RetRow label="Audio files" value={`${data.retention.audioRetentionDays}d`} />
                  <RetRow label="Documents" value={`${data.retention.documentRetentionDays}d`} />
                  <RetRow label="Audit trail" value={`${data.retention.auditRetentionDays}d`} />
                  <RetRow label="Legal holds" value={data.retention.legalHoldsEnabled ? "Enabled" : "Disabled"} />
                  <RetRow label="Secure deletion" value={data.retention.secureDeletion ? "On (NIST 800-88)" : "Off"} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Controls</CardTitle>
                  <CardDescription className="text-xs">Edit policy or apply legal hold</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => toast.info("Editing retention policy…")}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> Edit policy
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => toast.info("Applying legal hold…")}>
                    <Pause className="mr-1.5 h-3.5 w-3.5" /> Apply legal hold
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-red-700" onClick={() => toast.warning("Purge initiated", { description: "Requires dual authorization." })}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Initiate purge (dual-auth)
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent><EmptyState icon={Clock} message="No retention policy configured." /></CardContent></Card>
          )}
        </TabsContent>

        {/* ── Notifications ────────────────────────── */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-secondary" /> Notifications
                </CardTitle>
                <CardDescription className="text-xs">Per-recipient notifications</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {data.notifications.filter(n => !n.readAt).length} unread
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {data.notifications.length === 0 ? (
                <EmptyState icon={Bell} message="No notifications." />
              ) : (
                <ul className="max-h-[60vh] divide-y divide-border mf-scroll overflow-y-auto">
                  {data.notifications.map((n, i) => (
                    <motion.li
                      key={n.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className={cn(
                        "flex items-start gap-3 p-3 hover:bg-muted/40",
                        !n.readAt && "bg-secondary/5",
                      )}
                    >
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-muted" : "bg-secondary mf-pulse")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground">{n.title}</p>
                        {n.body && <p className="text-[11px] text-muted-foreground">{n.body}</p>}
                        <p className="text-[10px] text-muted-foreground">
                          {n.recipient} · {n.role} · {formatDateTime(n.createdAt)}
                        </p>
                      </div>
                      {!n.readAt && (
                        <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                          Mark read
                        </Button>
                      )}
                    </motion.li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Zero Trust ────────────────────────────── */}
        <TabsContent value="zero-trust" className="space-y-4">
          <ZeroTrustTab />
        </TabsContent>

        {/* ── SIEM ─────────────────────────────────── */}
        <TabsContent value="siem" className="space-y-4">
          <SiemTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-bold text-foreground">{value}</span>
    </div>
  );
}

// ── Zero Trust tab (Task 11-d) ────────────────────────────────────────────
interface ZeroTrustData {
  posture_score: number;
  posture_label: string;
  last_assessment: string;
  principles: Array<{
    id: string; name: string; status: "pass" | "warn" | "fail";
    description: string; coverage: number; details: string[];
  }>;
  micro_segmentation: {
    network_policies: number; default_deny: boolean;
    east_west_mtls: string; namespaces_segmented: number;
    blast_radius_isolation: string;
  };
  device_trust: {
    policy: string; posture_checks: string[];
    non_compliant_action: string; compliance_rate: number;
  };
  continuous_verification: {
    session_token_ttl_sec: number; re_auth_on_sensitive_action: boolean;
    risk_score_threshold: number; adaptive_auth_triggers: string[];
  };
  secrets_management: {
    provider: string; dynamic_secrets: boolean; rotation_cadence_days: number;
    secrets_in_code: number; secrets_in_env: number;
  };
  service_mesh: {
    provider: string; mTLS_enforced: string; traffic_policies: number;
    circuit_breakers: boolean; retry_policies: boolean;
  };
  network_access_control: {
    protocol: string; device_certificates: boolean;
    quarantine_vlan: string; non_compliant_devices_last_24h: number;
  };
  audit: {
    last_zero_trust_audit: string; next_audit: string;
    nist_800_207_alignment: string;
  };
}

const ZT_PRINCIPLE_BADGE: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700 border-emerald-300",
  warn: "bg-amber-100 text-amber-700 border-amber-300",
  fail: "bg-red-100 text-red-700 border-red-300",
};

function ZeroTrustTab() {
  const { data, loading, error, refresh } = useFetch<ZeroTrustData>("/api/medflow/zero-trust");

  if (loading) return <SectionLoading rows={4} />;
  if (error || !data) return <SectionError message={error ?? "Unknown"} onRetry={refresh} />;

  const scorePct = Math.round(data.posture_score * 100);
  const scoreColor = scorePct >= 80 ? "#16a085" : scorePct >= 60 ? "#E67E22" : "#C0392B";

  return (
    <>
      {/* Posture score gauge */}
      <Card>
        <CardContent className="flex items-center gap-6 p-6">
          <PostureGauge pct={scorePct} color={scoreColor} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Zero Trust Posture</p>
            <p className="text-2xl font-extrabold text-foreground">{data.posture_label}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Last assessment: <span className="font-semibold text-foreground">{data.last_assessment}</span>
            </p>
            <Badge variant="outline" className="mt-2 gap-1 text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-2.5 w-2.5" /> NIST SP 800-207 aligned
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 3 principle cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {data.principles.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-[14px]">{p.name}</CardTitle>
                  <Badge variant="outline" className={cn("text-[10px] capitalize", ZT_PRINCIPLE_BADGE[p.status])}>{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[12px] text-muted-foreground">{p.description}</p>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Coverage</span>
                    <span className="font-bold text-foreground">{Math.round(p.coverage * 100)}%</span>
                  </div>
                  <Progress value={p.coverage * 100} className="h-1.5" />
                </div>
                <ul className="space-y-1">
                  {p.details.map((d, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> {d}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Detailed cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ZtCard title="Micro-segmentation" icon={Network}>
          <ZtRow label="Network policies" value={`${data.micro_segmentation.network_policies}`} />
          <ZtRow label="Default deny" value={data.micro_segmentation.default_deny ? "✓ enforced" : "✗ off"} ok={data.micro_segmentation.default_deny} />
          <ZtRow label="East-West mTLS" value={data.micro_segmentation.east_west_mtls} />
          <ZtRow label="Namespaces segmented" value={`${data.micro_segmentation.namespaces_segmented}`} />
          <ZtRow label="Blast-radius isolation" value={data.micro_segmentation.blast_radius_isolation} />
        </ZtCard>

        <ZtCard title="Device Trust" icon={ShieldCheck}>
          <ZtRow label="Policy" value={data.device_trust.policy} />
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Posture checks</p>
            <div className="flex flex-wrap gap-1">
              {data.device_trust.posture_checks.map(c => (
                <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
              ))}
            </div>
          </div>
          <ZtRow label="Non-compliant action" value={data.device_trust.non_compliant_action} />
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Compliance rate</span>
              <span className="font-bold text-foreground">{Math.round(data.device_trust.compliance_rate * 100)}%</span>
            </div>
            <Progress value={data.device_trust.compliance_rate * 100} className="h-1.5" />
          </div>
        </ZtCard>

        <ZtCard title="Continuous Verification" icon={Eye}>
          <ZtRow label="Session token TTL" value={`${data.continuous_verification.session_token_ttl_sec}s`} />
          <ZtRow label="Re-auth on sensitive action" value={data.continuous_verification.re_auth_on_sensitive_action ? "✓ enabled" : "✗ off"} ok={data.continuous_verification.re_auth_on_sensitive_action} />
          <ZtRow label="Risk-score threshold" value={data.continuous_verification.risk_score_threshold.toFixed(2)} />
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adaptive auth triggers</p>
            <div className="flex flex-wrap gap-1">
              {data.continuous_verification.adaptive_auth_triggers.map(t => (
                <Badge key={t} variant="outline" className="text-[10px] border-secondary/40 text-secondary">{t.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          </div>
        </ZtCard>

        <ZtCard title="Secrets Management" icon={KeyRound}>
          <ZtRow label="Provider" value={data.secrets_management.provider} />
          <ZtRow label="Dynamic secrets" value={data.secrets_management.dynamic_secrets ? "✓ enabled" : "✗ off"} ok={data.secrets_management.dynamic_secrets} />
          <ZtRow label="Rotation cadence" value={`${data.secrets_management.rotation_cadence_days}d`} />
          <ZtRow label="Secrets in code" value={`${data.secrets_management.secrets_in_code}`} ok={data.secrets_management.secrets_in_code === 0} />
          <ZtRow label="Secrets in env" value={`${data.secrets_management.secrets_in_env}`} ok={data.secrets_management.secrets_in_env === 0} />
        </ZtCard>

        <ZtCard title="Service Mesh" icon={ServerCog}>
          <ZtRow label="Provider" value={data.service_mesh.provider} />
          <ZtRow label="mTLS enforced" value={data.service_mesh.mTLS_enforced} />
          <ZtRow label="Traffic policies" value={`${data.service_mesh.traffic_policies}`} />
          <ZtRow label="Circuit breakers" value={data.service_mesh.circuit_breakers ? "✓ on" : "✗ off"} ok={data.service_mesh.circuit_breakers} />
          <ZtRow label="Retry policies" value={data.service_mesh.retry_policies ? "✓ on" : "✗ off"} ok={data.service_mesh.retry_policies} />
        </ZtCard>

        <ZtCard title="Network Access Control" icon={Network}>
          <ZtRow label="Protocol" value={data.network_access_control.protocol} />
          <ZtRow label="Device certificates" value={data.network_access_control.device_certificates ? "✓ required" : "✗ off"} ok={data.network_access_control.device_certificates} />
          <ZtRow label="Quarantine VLAN" value={data.network_access_control.quarantine_vlan} />
          <ZtRow label="Non-compliant devices (24h)" value={`${data.network_access_control.non_compliant_devices_last_24h}`} ok={data.network_access_control.non_compliant_devices_last_24h === 0} />
        </ZtCard>
      </div>

      {/* Audit footer */}
      <Alert className="border-secondary/30 bg-secondary/5 [&>svg]:text-secondary">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Audit</AlertTitle>
        <AlertDescription className="text-[12px]">
          Last ZT audit: <span className="font-semibold text-foreground">{data.audit.last_zero_trust_audit}</span> · Next: <span className="font-semibold text-foreground">{data.audit.next_audit}</span> · NIST 800-207: <span className="font-semibold text-foreground">{data.audit.nist_800_207_alignment}</span>
        </AlertDescription>
      </Alert>
    </>
  );
}

function PostureGauge({ pct, color }: { pct: number; color: string }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e2eee9" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={c} strokeDashoffset={off}
        strokeLinecap="round" transform="rotate(-90 50 50)"
      />
      <text x="50" y="48" textAnchor="middle" className="fill-foreground text-[18px] font-extrabold">{pct}%</text>
      <text x="50" y="62" textAnchor="middle" className="fill-muted-foreground text-[7px] font-semibold uppercase">posture</text>
    </svg>
  );
}

function ZtCard({ title, icon: Icon, children }: { title: string; icon: typeof Network; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-secondary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function ZtRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn(
        "text-[11px] font-semibold",
        ok === true ? "text-emerald-700" : ok === false ? "text-red-700" : "text-foreground",
      )}>{value}</span>
    </div>
  );
}

// ── SIEM tab (Task 11-d) ──────────────────────────────────────────────────
interface SiemData {
  connection: {
    provider: string; status: string; endpoint: string;
    ingestion_method: string; connected_at: string; last_handshake: string;
  };
  log_streaming: {
    events_streamed_last_24h: number; events_streamed_last_7d: number;
    avg_ingest_latency_ms: number; backpressure_events: number;
    delivery_guarantee: string;
  };
  dashboards: Array<{
    id: string; name: string; framework: string;
    panels: number; last_viewed: string;
  }>;
  detection_rules: Array<{
    id: string; name: string; severity: string; status: string;
    triggered_24h: number; framework: string; mitre_attack: string;
  }>;
  alert_feed: Array<{
    id: string; timestamp: string; rule_id: string; severity: string;
    status: string; actor: string; detail: string; siem_correlation_id: string;
  }>;
  retention: {
    hot_retention_days: number; warm_retention_days: number;
    cold_retention_years: number; archival_target: string;
    audit_log_retention_years: number; mdr_retention_years: number;
  };
  integrations: {
    ticketing: string; pagerduty: string;
    threat_intel: string; vulnerability_scan: string;
  };
  coverage: {
    hipaa_controls_monitored: string;
    iso_27001_controls_monitored: string;
    hitrust_controls_monitored: string;
    soc2_trust_categories: string;
  };
  alert_count?: number;
}

const SIEM_STATUS_DOT: Record<string, string> = {
  open: "bg-red-500",
  acknowledged: "bg-amber-500",
  resolved: "bg-emerald-500",
};
const SIEM_STATUS_BADGE: Record<string, string> = {
  open: "bg-red-100 text-red-700 border-red-300",
  acknowledged: "bg-amber-100 text-amber-700 border-amber-300",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-300",
};
const SEVERITY_DOT: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};
const FRAMEWORK_BADGE: Record<string, string> = {
  HIPAA: "bg-emerald-100 text-emerald-700 border-emerald-300",
  GDPR: "bg-teal-100 text-teal-800 border-teal-300",
  "21 CFR 11": "bg-orange-100 text-orange-800 border-orange-300",
  "ISO 27001": "bg-slate-100 text-slate-700 border-slate-300",
  "NIST 800-207": "bg-cyan-100 text-cyan-800 border-cyan-300",
};

function SiemTab() {
  const { data, loading, error, refresh } = useFetch<SiemData>("/api/medflow/siem");

  if (loading) return <SectionLoading rows={4} />;
  if (error || !data) return <SectionError message={error ?? "Unknown"} onRetry={refresh} />;

  const ls = data.log_streaming;

  return (
    <>
      {/* Connection + Log Streaming StatCards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-secondary" /> Connection
            </CardTitle>
            <CardDescription className="text-xs">SIEM provider + endpoint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ZtRow label="Provider" value={data.connection.provider} />
            <ZtRow label="Status" value={data.connection.status} ok={data.connection.status === "connected"} />
            <ZtRow label="Endpoint" value={data.connection.endpoint} />
            <ZtRow label="Ingestion method" value={data.connection.ingestion_method} />
            <ZtRow label="Connected at" value={formatRelative(data.connection.connected_at)} />
            <ZtRow label="Last handshake" value={formatRelative(data.connection.last_handshake)} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <SiemStat icon={Activity} label="Events 24h" value={ls.events_streamed_last_24h} accent="text-secondary" />
          <SiemStat icon={Clock} label="Avg latency" value={`${ls.avg_ingest_latency_ms}ms`} accent="text-emerald-600" />
          <SiemStat icon={Activity} label="Backpressure" value={ls.backpressure_events} accent={ls.backpressure_events === 0 ? "text-emerald-600" : "text-red-600"} />
          <SiemStat icon={ShieldCheck} label="Delivery guarantee" value={ls.delivery_guarantee.split(" ")[0]} accent="text-secondary" />
        </div>
      </div>

      {/* Dashboards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dashboards</CardTitle>
          <CardDescription className="text-xs">{data.dashboards.length} configured</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Name</TableHead>
                <TableHead className="text-[11px]">Framework</TableHead>
                <TableHead className="text-[11px] text-right">Panels</TableHead>
                <TableHead className="text-[11px]">Last viewed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dashboards.map((d, i) => (
                <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: i * 0.03 }} className="hover:bg-muted/40">
                  <TableCell className="text-[12px] font-semibold text-foreground">{d.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", FRAMEWORK_BADGE[d.framework] ?? "bg-slate-100 text-slate-700 border-slate-300")}>{d.framework}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] font-semibold">{d.panels}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{d.last_viewed}</TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detection Rules */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detection Rules</CardTitle>
          <CardDescription className="text-xs">{data.detection_rules.length} active rules</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Rule</TableHead>
                <TableHead className="text-[11px]">Severity</TableHead>
                <TableHead className="text-[11px]">Status</TableHead>
                <TableHead className="text-[11px] text-right">Triggered 24h</TableHead>
                <TableHead className="text-[11px]">Framework</TableHead>
                <TableHead className="text-[11px]">MITRE ATT&CK</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.detection_rules.map((r, i) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: i * 0.03 }} className="hover:bg-muted/40">
                  <TableCell className="text-[12px] font-semibold text-foreground">{r.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[r.severity] ?? "bg-slate-400")} />
                      <span className="text-[11px] capitalize text-foreground">{r.severity}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px] capitalize", r.status === "active" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "")}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] font-semibold">{r.triggered_24h}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{r.framework}</TableCell>
                  <TableCell>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{r.mitre_attack}</span>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alert Feed */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Alert Feed</CardTitle>
            <CardDescription className="text-xs">{data.alert_feed.length} recent alerts</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="mr-1 h-3 w-3" /> Refresh</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] mf-scroll overflow-y-auto">
            <ul className="divide-y divide-border">
              {data.alert_feed.map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.03 }}
                  className="flex items-start gap-3 p-3 hover:bg-muted/40"
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[a.severity] ?? "bg-slate-400")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[11px] font-semibold text-foreground">{a.rule_id}</p>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", SIEM_STATUS_BADGE[a.status] ?? "")}>{a.status}</Badge>
                    </div>
                    <p className="text-[11px] text-foreground/80">{a.detail}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatRelative(a.timestamp)} · {a.actor} · <span className="font-mono">{a.siem_correlation_id}</span>
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Retention + Integrations */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Retention</CardTitle>
            <CardDescription className="text-xs">Hot/warm/cold tiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ZtRow label="Hot retention" value={`${data.retention.hot_retention_days}d`} />
            <ZtRow label="Warm retention" value={`${data.retention.warm_retention_days}d`} />
            <ZtRow label="Cold retention" value={`${data.retention.cold_retention_years}y`} />
            <ZtRow label="Audit log retention" value={`${data.retention.audit_log_retention_years}y`} />
            <ZtRow label="MDR retention" value={`${data.retention.mdr_retention_years}y`} />
            <ZtRow label="Archival target" value={data.retention.archival_target} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Integrations</CardTitle>
            <CardDescription className="text-xs">Auxiliary security integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ZtRow label="Ticketing" value={data.integrations.ticketing} />
            <ZtRow label="PagerDuty" value={data.integrations.pagerduty} />
            <ZtRow label="Threat intel" value={data.integrations.threat_intel} />
            <ZtRow label="Vuln scanner" value={data.integrations.vulnerability_scan} />
          </CardContent>
        </Card>
      </div>

      {/* Coverage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coverage</CardTitle>
          <CardDescription className="text-xs">Framework controls monitored</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CoverageBar label="HIPAA" value={data.coverage.hipaa_controls_monitored} pct={37 / 54} />
          <CoverageBar label="ISO 27001" value={data.coverage.iso_27001_controls_monitored} pct={81 / 93} />
          <CoverageBar label="HITRUST" value={data.coverage.hitrust_controls_monitored} pct={0.5} />
          <CoverageBar label="SOC 2" value={data.coverage.soc2_trust_categories} pct={1} />
        </CardContent>
      </Card>
    </>
  );
}

function SiemStat({ icon: Icon, label, value, accent }: { icon: typeof Activity; label: string; value: string | number; accent: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-lg font-extrabold leading-none text-foreground">{value}</p>
        <p className={cn("mt-0.5 text-[10px] font-medium", accent)}>{label}</p>
      </CardContent>
    </Card>
  );
}

function CoverageBar({ label, value, pct: pctVal }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <Progress value={pctVal * 100} className="h-1.5" />
    </div>
  );
}
