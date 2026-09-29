"use client";
// MedFlow — Audit & Security (audit trail, alerts, retention, notifications).

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertOctagon, Bell, CheckCircle2, Clock, FileText, Filter, Pause, RefreshCw,
  ShieldAlert, ShieldCheck, Trash2, Unlock,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
