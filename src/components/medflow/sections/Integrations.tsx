"use client";
// MedFlow — Integrations (EHR adapters + multi-DB connectors).
// Two tabs: "EHR & Delivery" uses useFetch('/api/medflow/integrations').
// "Database Connectors" uses fetchDbConnectors / testDbConnector / switchDbConnector
// from src/lib/medflow/api.ts (FastAPI on :8000).

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Database, FileJson, FileText, Loader2,
  Plug, RefreshCw, ServerCog, Settings as SettingsIcon, Sparkles, ToggleLeft,
  Terminal, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/medflow/useFetch";
import { fetchDbConnectors, fetchFhir, fetchHl7, switchDbConnector, testDbConnector } from "@/lib/medflow/api";
import type { DbConnector, DbTestResult } from "@/lib/medflow/types";
import { formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

interface Integration {
  id: string;
  type: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  config?: unknown;
}
interface DeliveryDestination {
  id: string;
  name: string;
  type: string;
}

const EHR_META: Record<string, { color: string; icon: string }> = {
  epic: { color: "#7B3F99", icon: "Building" },
  cerner: { color: "#0B5345", icon: "Database" },
  allscripts: { color: "#1ABC9C", icon: "Activity" },
  athena: { color: "#16a085", icon: "Shield" },
  hl7_fhir: { color: "#2980B9", icon: "FileJson" },
  hl7_v2: { color: "#48C9B0", icon: "FileText" },
  sftp: { color: "#8B7355", icon: "Server" },
  rest_webhook: { color: "#E67E22", icon: "Webhook" },
};

export function Integrations() {
  const integFetch = useFetch<{ integrations: Integration[]; deliveryDestinations: DeliveryDestination[] }>("/api/medflow/integrations");
  const [tab, setTab] = useState("ehr");
  const [connectors, setConnectors] = useState<DbConnector[] | null>(null);
  const [connLoading, setConnLoading] = useState(true);
  const [connError, setConnError] = useState<string | null>(null);
  const [activeConnector, setActiveConnector] = useState<string>("sqlite");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, DbTestResult>>({});
  const [connStrings, setConnStrings] = useState<Record<string, string>>({});
  const [switching, setSwitching] = useState<string | null>(null);
  const [schema, setSchema] = useState<Array<{ entity: string; fields: number; relations: number; tenant_scoped: boolean }> | null>(null);
  const [fhirOpen, setFhirOpen] = useState(false);
  const [hl7Open, setHl7Open] = useState(false);
  const [fhirPayload, setFhirPayload] = useState("");
  const [hl7Payload, setHl7Payload] = useState("");

  async function loadConnectors() {
    setConnLoading(true);
    setConnError(null);
    try {
      const list = await fetchDbConnectors();
      setConnectors(list);
      const active = list.find(c => c.default || c.status === "active") ?? list[0];
      setActiveConnector(active?.id ?? "sqlite");
    } catch (e) {
      setConnError((e as Error).message);
    } finally {
      setConnLoading(false);
    }
  }

  async function loadSchema() {
    try {
      const res = await fetch("/api/db/schema?XTransformPort=8000", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const rows = (data.entities ?? []).map((e: { entity: string; fields: number; relations: number; tenant_scoped: boolean }) => ({
          entity: e.entity, fields: e.fields, relations: e.relations, tenant_scoped: e.tenant_scoped,
        }));
        setSchema(rows);
      }
    } catch (e) {
      console.error("schema fetch failed", e);
    }
  }

  useEffect(() => {
    loadConnectors();
    loadSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTest(c: DbConnector) {
    const connStr = connStrings[c.id] ?? c.connection_string_format;
    setTesting(c.id);
    try {
      const result = await testDbConnector(c.engine, connStr);
      setTestResults(prev => ({ ...prev, [c.id]: result }));
      if (result.status === "ok") {
        toast.success(`${c.label} connection OK`, { description: `Latency ${result.latency_ms}ms` });
      } else {
        toast.error(`${c.label} connection failed`, { description: result.validation_errors.join("; ") || "Unknown" });
      }
    } catch (e) {
      toast.error(`Test failed: ${(e as Error).message}`);
    } finally {
      setTesting(null);
    }
  }

  async function handleSwitch(c: DbConnector) {
    const connStr = connStrings[c.id] ?? c.connection_string_format;
    setSwitching(c.id);
    try {
      const res = await switchDbConnector(c.engine, connStr);
      setActiveConnector(c.id);
      setConnectors(prev => prev?.map(x => ({ ...x, status: x.id === c.id ? "active" : "inactive", default: x.id === c.id })) ?? null);
      toast.success(`Switched active DB to ${c.label}`, {
        description: `${res.migrated_tables} tables migrated · connector=${res.active_connector}`,
      });
    } catch (e) {
      toast.error(`Switch failed: ${(e as Error).message}`);
    } finally {
      setSwitching(null);
    }
  }

  async function handleViewFhir() {
    setFhirOpen(true);
    setFhirPayload("Loading…");
    try {
      const p = await fetchFhir("JOB-2024-006");
      setFhirPayload(JSON.stringify(p, null, 2));
    } catch (e) {
      setFhirPayload(`Error: ${(e as Error).message}`);
    }
  }
  async function handleViewHl7() {
    setHl7Open(true);
    setHl7Payload("Loading…");
    try {
      const p = await fetchHl7("JOB-2024-006");
      setHl7Payload(p);
    } catch (e) {
      setHl7Payload(`Error: ${(e as Error).message}`);
    }
  }

  const loading = integFetch.loading || connLoading;
  const error = integFetch.error ?? connError;

  if (loading) return (
    <div>
      <PageHeader title="Integrations" description="EHR adapters, delivery destinations, and multi-DB provider abstraction." icon={Plug} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !integFetch.data || !connectors) return (
    <div>
      <PageHeader title="Integrations" description="EHR adapters, delivery destinations, and multi-DB provider abstraction." icon={Plug} />
      <SectionError message={error ?? "Unknown"} onRetry={() => { integFetch.refresh(); loadConnectors(); }} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="EHR adapters, delivery destinations, and a multi-DB provider abstraction layer."
        icon={Plug}
        actions={
          <Button variant="outline" size="sm" onClick={() => { integFetch.refresh(); loadConnectors(); loadSchema(); }}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="ehr">EHR & Delivery</TabsTrigger>
          <TabsTrigger value="db">Database Connectors</TabsTrigger>
        </TabsList>

        {/* ── EHR & Delivery ────────────────────────────────── */}
        <TabsContent value="ehr" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integFetch.data.integrations.map((i, idx) => {
              const meta = EHR_META[i.type] ?? EHR_META.rest_webhook;
              const ok = i.status === "connected" || i.status === "active";
              return (
                <motion.div
                  key={i.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                >
                  <Card className="h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <span className="grid h-10 w-10 place-items-center rounded-lg text-white" style={{ background: meta.color }}>
                          <Database className="h-5 w-5" />
                        </span>
                        <Badge variant="outline" className={cn("text-[10px]", ok ? "text-emerald-700 border-emerald-300 bg-emerald-50" : "text-amber-700 border-amber-300 bg-amber-50")}>
                          {i.status}
                        </Badge>
                      </div>
                      <CardTitle className="mt-2 text-base">{i.name}</CardTitle>
                      <CardDescription className="text-[11px] uppercase tracking-wider">{i.type}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Last sync</span>
                        <span>{i.lastSyncAt ? formatRelative(i.lastSyncAt) : "never"}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => toast.info(`Configure ${i.name}`)}>
                          <SettingsIcon className="mr-1 h-3 w-3" /> Configure
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toast.info("Test sync", { description: i.name })}>
                          <Zap className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Delivery destinations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivery destinations</CardTitle>
              <CardDescription className="text-xs">Where completed documents land</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {integFetch.data.deliveryDestinations.map(d => (
                  <Badge key={d.id} variant="outline" className="gap-1 text-[11px]">
                    <FileJson className="h-3 w-3 text-secondary" /> {d.name} · {d.type}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleViewFhir}>
                  <FileJson className="mr-1.5 h-3.5 w-3.5 text-secondary" /> Test FHIR (JOB-2024-006)
                </Button>
                <Button size="sm" variant="outline" onClick={handleViewHl7}>
                  <FileText className="mr-1.5 h-3.5 w-3.5 text-secondary" /> Test HL7 (JOB-2024-006)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Database Connectors ───────────────────────────── */}
        <TabsContent value="db" className="space-y-4">
          {/* Provider abstraction callout */}
          <div className="flex items-start gap-3 rounded-xl border border-secondary/30 bg-secondary/5 p-4">
            <ServerCog className="mt-0.5 h-5 w-5 text-secondary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Provider abstraction — switch between SQLite/Postgres/Supabase/MySQL/MongoDB without application rewrites.</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                All connectors share the same Prisma schema + repository contract. Active connector:{" "}
                <span className="font-bold text-secondary">{connectors.find(c => c.id === activeConnector)?.label ?? "SQLite"}</span>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connectors.map((c, idx) => {
              const isActive = c.id === activeConnector;
              const tr = testResults[c.id];
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                >
                  <Card className={cn("relative h-full overflow-hidden", isActive && "ring-2 ring-secondary")}>
                    <div className="h-1 w-full" style={{ background: c.color }} />
                    <CardHeader className="pb-2 pt-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: c.color }}>
                            <Database className="h-4 w-4" />
                          </span>
                          <div>
                            <CardTitle className="text-base">{c.label}</CardTitle>
                            <CardDescription className="text-[11px] uppercase">{c.engine}</CardDescription>
                          </div>
                        </div>
                        {isActive ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">
                            <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="mb-2 flex flex-wrap gap-1">
                        {c.supports.map(s => (
                          <span key={s} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-foreground/70">
                            {s}
                          </span>
                        ))}
                      </div>
                      <p className="mb-2 font-mono text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground">conn:</span> {c.connection_string_format}
                      </p>
                      <p className="mb-3 text-[11px] text-muted-foreground">{c.notes}</p>

                      <Input
                        placeholder="Paste connection string…"
                        value={connStrings[c.id] ?? ""}
                        onChange={e => setConnStrings(prev => ({ ...prev, [c.id]: e.target.value }))}
                        className="mb-2 h-8 font-mono text-[11px]"
                      />

                      {tr && (
                        <div className={cn(
                          "mb-2 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]",
                          tr.status === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-red-300 bg-red-50 text-red-700",
                        )}>
                          {tr.status === "ok" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          <span>{tr.status === "ok" ? `OK · ${tr.latency_ms}ms` : `FAILED`}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleTest(c)}
                          disabled={testing === c.id}
                        >
                          {testing === c.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Terminal className="mr-1 h-3 w-3" />}
                          Test
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-primary text-primary-foreground"
                          onClick={() => handleSwitch(c)}
                          disabled={switching === c.id || isActive}
                        >
                          {switching === c.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ToggleLeft className="mr-1 h-3 w-3" />}
                          {isActive ? "Active" : "Switch"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Schema entities */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-secondary" /> Schema entities
                </CardTitle>
                <CardDescription className="text-xs">Prisma entities served by the active connector</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                <Sparkles className="mr-1 h-3 w-3 text-secondary" /> {schema?.length ?? 0} entities
              </Badge>
            </CardHeader>
            <CardContent>
              {!schema ? (
                <EmptyState icon={Database} message="Schema not loaded." />
              ) : (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {schema.map(s => (
                    <div key={s.entity} className="rounded-md border border-border bg-muted/30 p-2">
                      <p className="font-mono text-[11px] font-semibold text-foreground">{s.entity}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.fields} fields · {s.relations} rels
                      </p>
                      {s.tenant_scoped && (
                        <Badge variant="outline" className="mt-1 text-[9px] text-secondary border-secondary/40">tenant-scoped</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* FHIR dialog */}
      <Dialog open={fhirOpen} onOpenChange={setFhirOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-secondary" /> FHIR R4 Bundle — JOB-2024-006
            </DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] mf-scroll overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
{fhirPayload}
          </pre>
        </DialogContent>
      </Dialog>

      {/* HL7 dialog */}
      <Dialog open={hl7Open} onOpenChange={setHl7Open}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-secondary" /> HL7 v2 MDM — JOB-2024-006
            </DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] mf-scroll overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
{hl7Payload}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
