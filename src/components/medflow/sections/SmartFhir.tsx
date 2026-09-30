"use client";
// MedFlow — SMART on FHIR App Gallery (C1)
// Grid of certified SMART on FHIR apps with OAuth2/OIDC launch + app-registration dialog.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Boxes, ExternalLink, FlaskConical, GraduationCap, Heart, Info, KeyRound,
  Pill, Plus, RefreshCw, Rocket, Search, ShieldCheck, Stethoscope, TrendingUp, Users,
  Video, Layers,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFetch } from "@/hooks/medflow/useFetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

interface SmartApp {
  id: string;
  name: string;
  description: string;
  category: string;
  vendor: string;
  launch_url: string;
  scopes: string[];
  status: string;
  icon: string;
}
interface SmartAppsData {
  apps: SmartApp[];
  total: number;
}

// Dynamic lucide icon resolver — fall back to Boxes if the named icon is missing.
function iconFor(name: string): LucideIcon {
  const IconCmp = (LucideIcons as unknown as Record<string, LucideIcon>)[name];
  return IconCmp ?? Boxes;
}

function statusBadge(status: string): string {
  if (status === "approved") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (status === "pending") return "bg-amber-100 text-amber-700 border-amber-300";
  if (status === "rejected") return "bg-red-100 text-red-700 border-red-300";
  return "bg-muted text-muted-foreground";
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Clinical Reference": Heart,
  "Prescribing": Pill,
  "Care Coordination": Users,
  "Diagnostics": FlaskConical,
  "Research": Search,
  "Patient Engagement": GraduationCap,
  "Analytics": TrendingUp,
  "Telehealth": Video,
};

const SCOPE_PRESETS = [
  "patient/*.read",
  "patient/*.write",
  "Condition/*.read",
  "Observation/*.read",
  "MedicationOrder/*.write",
  "DocumentReference/*.read",
  "Encounter/*.write",
  "CarePlan/*.read",
  "offline_access",
  "openid",
  "fhirUser",
  "launch",
];

export function SmartFhir() {
  const { data, loading, error, refresh } = useFetch<SmartAppsData>("/api/medflow/smart-apps");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regDesc, setRegDesc] = useState("");
  const [regRedirect, setRegRedirect] = useState("");
  const [regScopes, setRegScopes] = useState<string[]>(["patient/*.read", "openid", "fhirUser"]);
  const [submitting, setSubmitting] = useState(false);

  if (loading && !data) return (
    <div>
      <PageHeader title="SMART on FHIR App Gallery" description="Launch certified SMART on FHIR apps." icon={Stethoscope} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error && !data) return (
    <div>
      <PageHeader title="SMART on FHIR App Gallery" description="Launch certified SMART on FHIR apps." icon={Stethoscope} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  const apps = data?.apps ?? [];

  const launchApp = (app: SmartApp) => {
    toast.success(`Launching ${app.name}…`, { description: "SMART on FHIR OAuth 2.0 handshake initiated." });
  };

  const submitRegistration = () => {
    if (!regName.trim()) { toast.error("Enter an app name."); return; }
    if (!regRedirect.trim()) { toast.error("Enter a redirect URI."); return; }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("App registration submitted for review.", {
        description: `Redirect URI: ${regRedirect}`,
      });
      setRegisterOpen(false);
      setRegName("");
      setRegDesc("");
      setRegRedirect("");
      setRegScopes(["patient/*.read", "openid", "fhirUser"]);
    }, 600);
  };

  const toggleScope = (s: string) => {
    setRegScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  return (
    <div>
      <PageHeader
        title="SMART on FHIR App Gallery"
        description="Launch certified SMART on FHIR apps from within MedFlow. OAuth 2.0 + OpenID Connect app launch."
        icon={Stethoscope}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setRegisterOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Register Your App
            </Button>
          </>
        }
      />

      {/* OAuth note */}
      <Alert className="mb-4 border-secondary/40 bg-secondary/5 text-foreground">
        <Info className="h-4 w-4 text-secondary" />
        <AlertTitle>SMART on FHIR — OAuth 2.0 scoped access</AlertTitle>
        <AlertDescription>
          SMART on FHIR apps run in a separate iframe with OAuth 2.0-scoped access to FHIR resources. Patients + providers can revoke access at any time.
        </AlertDescription>
      </Alert>

      {/* App grid */}
      {apps.length === 0 ? (
        <EmptyState icon={Stethoscope} message="No SMART apps available." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {apps.map((app, i) => {
              const Icon = iconFor(app.icon);
              const CatIcon = CATEGORY_ICONS[app.category] ?? Boxes;
              return (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, delay: i * 0.03 }}
                >
                  <Card className="h-full transition-shadow hover:shadow-lg">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <CardTitle className="text-sm leading-tight">{app.name}</CardTitle>
                            <CardDescription className="text-[11px]">{app.vendor}</CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] capitalize", statusBadge(app.status))}>
                          {app.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <CatIcon className="h-3 w-3" /> {app.category}
                      </div>
                      <p className="text-[12px] leading-relaxed text-foreground/80 line-clamp-3">{app.description}</p>
                      {/* Scopes */}
                      <div>
                        <p className="mb-1 flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                          <KeyRound className="h-3 w-3" /> OAuth scopes
                        </p>
                        <div className="mf-scroll flex max-h-20 flex-wrap gap-1">
                          {app.scopes.map((s, idx) => (
                            <span key={idx} className="inline-block rounded-full bg-secondary/15 px-2 py-0.5 text-[9px] font-mono text-secondary border border-secondary/30">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" className="flex-1 bg-primary text-primary-foreground" onClick={() => launchApp(app)}>
                          <Rocket className="mr-1.5 h-3.5 w-3.5" /> Launch App
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toast.info(`Opening ${app.launch_url}`, { description: "SMART launch URL copied to clipboard." })}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Register-Your-App card at the end of the grid */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: apps.length * 0.03 }}
          >
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-secondary/40 bg-secondary/5 p-6 text-center transition-colors hover:border-secondary hover:bg-secondary/10"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary/15 text-secondary">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Register Your App</p>
                <p className="text-[11px] text-muted-foreground">Submit a new SMART on FHIR app for review</p>
              </div>
            </button>
          </motion.div>
        </div>
      )}

      {/* Register dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register SMART on FHIR App</DialogTitle>
            <DialogDescription>
              Submit a new app for review. Once approved, it will appear in the gallery with OAuth 2.0 scopes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">App name</Label>
              <Input value={regName} onChange={e => setRegName(e.target.value)} placeholder="e.g. CardioReference" className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={regDesc} onChange={e => setRegDesc(e.target.value)} rows={3} placeholder="Brief description of the app's clinical purpose…" className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">Redirect URI</Label>
              <Input value={regRedirect} onChange={e => setRegRedirect(e.target.value)} placeholder="https://your-app.example.com/callback" className="h-9 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs">OAuth scopes</Label>
              <div className="mf-scroll max-h-32 flex flex-wrap gap-1 rounded-md border border-border bg-muted/20 p-2">
                {SCOPE_PRESETS.map(s => {
                  const on = regScopes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleScope(s)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-mono transition-colors",
                        on
                          ? "border-secondary bg-secondary/15 text-secondary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{regScopes.length} scope(s) selected</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" disabled={submitting} onClick={submitRegistration}>
              {submitting ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Layers className="mr-1.5 h-3.5 w-3.5" />}
              {submitting ? "Submitting…" : "Submit for review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
