"use client";
// MedFlow — White-Labeled Client Portal (E3).
// Two-column layout: LEFT = portal config (branding, client users, stats,
// feature toggles, SSO); RIGHT = a framed browser-chrome mockup preview
// applying the portal's branding colors (mini landing page).

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck, CheckCircle2, Clock, Globe, ImageIcon, Lock, Palette,
  Pencil, RefreshCw, ShieldCheck, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatRelative } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";

interface PortalConfig {
  portal_id: string;
  tenant: string;
  branding: {
    portal_name: string;
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    bg_color: string;
    font_family: string;
  };
  domain: string;
  status: string;
  launched_at: string;
  allowed_job_types: string[];
  allowed_specialties: string[];
  client_users: Array<{
    id: string; name: string; email: string; role: string;
    last_login: string; jobs_submitted: number;
  }>;
  stats: {
    total_jobs_submitted: number;
    total_jobs_delivered: number;
    avg_tat_hours: number;
    sla_compliance_pct: number;
    quality_score_avg: number;
    monthly_audio_minutes: number;
    current_month_usage_pct: number;
  };
  features_enabled: Record<string, boolean>;
  portal_preview_url: string;
  sso_enabled: boolean;
  sso_provider: string;
  custom_domain_verified: boolean;
  ssl_certificate: string;
}

const ROLE_BADGE: Record<string, string> = {
  Provider: "bg-emerald-100 text-emerald-700 border-emerald-300",
  "Operations Manager": "bg-amber-100 text-amber-800 border-amber-300",
  "Billing User": "bg-cyan-100 text-cyan-800 border-cyan-300",
};

export function ClientPortal() {
  const { data, loading, error, refresh } = useFetch<PortalConfig>("/api/medflow/client-portal");
  const [editOpen, setEditOpen] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  function featureState(key: string, val: boolean): boolean {
    if (key in features) return features[key];
    return val;
  }

  function toggleFeature(key: string, val: boolean) {
    setFeatures(prev => ({ ...prev, [key]: !val }));
    toast.success("Feature updated", { description: `${key}: ${!val ? "ON" : "OFF"}` });
  }

  if (loading) return (
    <div>
      <PageHeader title="Client Portal" description="White-labeled portal for healthcare clients to submit + track dictations, view SLA reports, download invoices." icon={Globe} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Client Portal" description="White-labeled portal for healthcare clients to submit + track dictations, view SLA reports, download invoices." icon={Globe} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  const stats = data.stats;

  return (
    <div>
      <PageHeader
        title="Client Portal"
        description="White-labeled portal for healthcare clients to submit + track dictations, view SLA reports, download invoices."
        icon={Globe}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT — portal config (2/3 width) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Branding */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="h-4 w-4 text-secondary" /> Branding
                </CardTitle>
                <CardDescription className="text-xs">White-label portal identity</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-3 w-3" /> Edit branding
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <BrandingField label="Portal name" value={data.branding.portal_name} />
                <BrandingField label="Domain" value={data.domain} verified={data.custom_domain_verified} />
                <BrandingField label="Font family" value={data.branding.font_family} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ColorSwatch label="Primary" color={data.branding.primary_color} />
                <ColorSwatch label="Secondary" color={data.branding.secondary_color} />
                <ColorSwatch label="Accent" color={data.branding.accent_color} />
                <ColorSwatch label="Background" color={data.branding.bg_color} />
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-muted-foreground">{data.branding.logo_url}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Users */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-secondary" /> Client Users
                </CardTitle>
                <CardDescription className="text-xs">{data.client_users.length} active portal users</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] mf-scroll overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px]">Name</TableHead>
                      <TableHead className="text-[11px]">Role</TableHead>
                      <TableHead className="text-[11px]">Last login</TableHead>
                      <TableHead className="text-[11px] text-right">Jobs submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.client_users.map((u, i) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: i * 0.03 }}
                        className="hover:bg-muted/40"
                      >
                        <TableCell>
                          <p className="text-[12px] font-semibold text-foreground">{u.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{u.email}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px]", ROLE_BADGE[u.role] ?? "bg-slate-100 text-slate-700 border-slate-300")}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">{formatRelative(u.last_login)}</TableCell>
                        <TableCell className="text-right font-mono text-[11px] font-semibold">{u.jobs_submitted}</TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon={Globe} label="Total Submitted" value={stats.total_jobs_submitted} accent="text-secondary" sub="all-time" />
            <StatCard icon={CheckCircle2} label="Delivered" value={stats.total_jobs_delivered} accent="text-emerald-600" sub="completed" deltaTone="up" delta={`${stats.total_jobs_delivered}`} />
            <StatCard icon={Clock} label="Avg TAT" value={`${stats.avg_tat_hours.toFixed(1)}h`} accent="text-amber-600" sub="turn-around" />
            <StatCard icon={BadgeCheck} label="SLA %" value={`${stats.sla_compliance_pct.toFixed(1)}%`} accent="text-secondary" sub="compliance" />
            <StatCard icon={ShieldCheck} label="Quality" value={stats.quality_score_avg.toFixed(1)} accent="text-emerald-600" sub="avg score" />
            <StatCard icon={Clock} label="Monthly Usage" value={`${stats.current_month_usage_pct.toFixed(1)}%`} accent="text-secondary" sub={`${stats.monthly_audio_minutes.toFixed(0)} min`} />
          </div>

          {/* Features */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Pencil className="h-4 w-4 text-secondary" /> Portal Features
              </CardTitle>
              <CardDescription className="text-xs">Toggle per-portal capability flags</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.features_enabled).map(([key, val]) => {
                  const cur = featureState(key, val);
                  return (
                    <div key={key} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                      <span className="text-[11px] font-medium text-foreground">{key.replace(/_/g, " ")}</span>
                      <Switch checked={cur} onCheckedChange={() => toggleFeature(key, val)} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* SSO */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-secondary" /> Single Sign-On (SSO)
              </CardTitle>
              <CardDescription className="text-xs">Federated authentication for the portal</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <SsoRow label="SSO enabled" value={data.sso_enabled ? "Yes" : "No"} ok={data.sso_enabled} />
              <SsoRow label="SSO provider" value={data.sso_provider} />
              <SsoRow label="Custom domain verified" value={data.custom_domain_verified ? "Yes" : "No"} ok={data.custom_domain_verified} />
              <SsoRow label="SSL certificate" value={data.ssl_certificate} />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Portal Preview (1/3 width) */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-secondary" /> Portal Preview
              </CardTitle>
              <CardDescription className="text-xs">{data.domain}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Browser chrome mockup */}
              <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-100 shadow-sm">
                <div className="flex items-center gap-1.5 border-b border-slate-300 bg-slate-200 px-2 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <div className="ml-2 flex-1 truncate rounded-sm bg-white px-2 py-0.5 text-[9px] font-mono text-slate-500">
                    https://{data.domain}
                  </div>
                </div>
                {/* Mini landing page with branding applied */}
                <div style={{ background: data.branding.bg_color, fontFamily: data.branding.font_family }}>
                  {/* Hero */}
                  <div className="px-4 py-5 text-center" style={{ background: data.branding.primary_color }}>
                    <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-white/20" />
                    <p className="text-[11px] font-bold text-white">{data.branding.portal_name}</p>
                    <p className="mt-0.5 text-[9px] text-white/80">Secure medical transcription portal</p>
                  </div>
                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 p-3">
                    <button
                      className="rounded-md px-3 py-1.5 text-[10px] font-semibold text-white"
                      style={{ background: data.branding.secondary_color }}
                    >
                      + Submit Dictation
                    </button>
                    <button
                      className="rounded-md border px-3 py-1.5 text-[10px] font-semibold"
                      style={{ borderColor: data.branding.primary_color, color: data.branding.primary_color }}
                    >
                      Track Jobs
                    </button>
                  </div>
                  {/* Mini stats row */}
                  <div className="grid grid-cols-3 gap-1 border-t border-slate-200 p-2" style={{ background: "rgba(255,255,255,0.6)" }}>
                    <PreviewStat label="Submitted" value={stats.total_jobs_submitted} color={data.branding.primary_color} />
                    <PreviewStat label="Delivered" value={stats.total_jobs_delivered} color={data.branding.secondary_color} />
                    <PreviewStat label="SLA" value={`${Math.round(stats.sla_compliance_pct)}%`} color={data.branding.accent_color} />
                  </div>
                  {/* Footer */}
                  <div className="border-t border-slate-200 px-3 py-1.5" style={{ background: data.branding.accent_color }}>
                    <p className="text-center text-[8px] font-medium text-white/80">
                      {data.tenant} · HIPAA · {data.ssl_certificate.split(" ")[0]}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Live preview with {data.branding.portal_name} branding applied
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Branding dialog (mock — toasts on submit) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-secondary" /> Edit branding
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Portal name</label>
              <Input defaultValue={data.branding.portal_name} className="h-9 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="Primary" defaultValue={data.branding.primary_color} />
              <ColorInput label="Secondary" defaultValue={data.branding.secondary_color} />
              <ColorInput label="Accent" defaultValue={data.branding.accent_color} />
              <ColorInput label="Background" defaultValue={data.branding.bg_color} />
            </div>
            <Button
              className="mt-2 w-full bg-primary text-primary-foreground"
              onClick={() => {
                setEditOpen(false);
                toast.success("Branding saved", { description: "Portal will re-deploy with new colors in ~30s." });
              }}
            >
              Save branding
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrandingField({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] font-semibold text-foreground">
        {value}
        {verified && <BadgeCheck className="h-3 w-3 shrink-0 text-emerald-600" />}
      </p>
    </div>
  );
}

function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-6 w-6 rounded-md border border-border" style={{ background: color }} />
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-mono text-[10px] text-foreground">{color}</p>
      </div>
    </div>
  );
}

function ColorInput({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" defaultValue={defaultValue} className="h-9 w-12 cursor-pointer rounded border border-border bg-card" />
        <Input defaultValue={defaultValue} className="h-9 font-mono text-[11px]" />
      </div>
    </div>
  );
}

function SsoRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
        {ok === true && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
        {ok === false && <Lock className="h-3 w-3 text-red-600" />}
        {value}
      </span>
    </div>
  );
}

function PreviewStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
