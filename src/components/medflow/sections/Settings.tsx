"use client";
// MedFlow — Settings (org profile, feature flags, retention, danger zone).

import { useState } from "react";
import {
  AlertTriangle, Building2, Clock, Database, Globe, Save, Settings as SettingsIcon,
  Shield, ShieldCheck, Sparkles, Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PageHeader } from "./_shared";

export function Settings() {
  const [name, setName] = useState("Cardinal Health Systems");
  const [slug, setSlug] = useState("cardinal-health");
  const [country, setCountry] = useState("US");
  const [tz, setTz] = useState("America/New_York");
  const [tatRoutine, setTatRoutine] = useState("24");
  const [tatUrgent, setTatUrgent] = useState("12");
  const [tatStat, setTatStat] = useState("4");

  const [flagAi, setFlagAi] = useState(true);
  const [flagQa, setFlagQa] = useState(true);
  const [flagFhir, setFlagFhir] = useState(true);
  const [flagMfa, setFlagMfa] = useState(true);

  const [retAudio, setRetAudio] = useState("90");
  const [retDocs, setRetDocs] = useState("2555");
  const [retAudit, setRetAudit] = useState("2555");

  function saveAll() {
    toast.success("Settings saved", {
      description: "All changes persisted to the demo tenant.",
    });
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Organization profile, feature flags, retention policy, and danger zone."
        icon={SettingsIcon}
        actions={
          <Button size="sm" onClick={saveAll} className="bg-primary text-primary-foreground">
            <Save className="mr-1.5 h-3.5 w-3.5" /> Save changes
          </Button>
        }
      />

      {/* Demo banner */}
      <Alert className="mb-4 border-secondary/40 bg-secondary/5 text-foreground [&>svg]:text-secondary">
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Demo tenant — synthetic data only</AlertTitle>
        <AlertDescription>
          This tenant is seeded with synthetic patients, providers, and jobs. No PHI is present. All actions are audit-logged.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Org profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-secondary" /> Organization profile
            </CardTitle>
            <CardDescription className="text-xs">Identity, locale, default SLA targets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Organization name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={slug} onChange={e => setSlug(e.target.value)} className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="AU">Australia</SelectItem>
                    <SelectItem value="IN">India</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Timezone</Label>
                <Select value={tz} onValueChange={setTz}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Logo upload</Label>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">Drop SVG / PNG here (max 512KB)</p>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.info("Uploading logo…")}>
                  Choose file
                </Button>
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Default turnaround targets (hours)</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px]">Routine</Label>
                  <Input value={tatRoutine} onChange={e => setTatRoutine(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-[10px]">Urgent</Label>
                  <Input value={tatUrgent} onChange={e => setTatUrgent(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-[10px]">STAT</Label>
                  <Input value={tatStat} onChange={e => setTatStat(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature flags */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-secondary" /> Feature flags
            </CardTitle>
            <CardDescription className="text-xs">Toggle AI, QA, FHIR, MFA features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FlagRow
              title="AI transcription" desc="Whisper-large-v3 + medical adapters"
              checked={flagAi} onCheckedChange={setFlagAi}
            />
            <FlagRow
              title="QA auto-route" desc="Automatically route to QA after editing"
              checked={flagQa} onCheckedChange={setFlagQa}
            />
            <FlagRow
              title="FHIR delivery" desc="Generate FHIR R4 DocumentReference"
              checked={flagFhir} onCheckedChange={setFlagFhir}
            />
            <FlagRow
              title="MFA enforcement" desc="Require TOTP / WebAuthn for all users"
              checked={flagMfa} onCheckedChange={setFlagMfa}
            />
          </CardContent>
        </Card>

        {/* Data retention */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-secondary" /> Data retention policy
            </CardTitle>
            <CardDescription className="text-xs">Per-data-class retention windows (days)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Audio retention (days)</Label>
              <Input value={retAudio} onChange={e => setRetAudio(e.target.value)} />
            </div>
            <div>
              <Label>Document retention (days)</Label>
              <Input value={retDocs} onChange={e => setRetDocs(e.target.value)} />
            </div>
            <div>
              <Label>Audit retention (days)</Label>
              <Input value={retAudit} onChange={e => setRetAudit(e.target.value)} />
            </div>
            <div className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-secondary" />
              Secure deletion (NIST 800-88) · Legal holds enabled · Encryption at rest (AES-256)
            </div>
          </CardContent>
        </Card>

        {/* Plan & billing + Active DB */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-secondary" /> Plan & infrastructure
            </CardTitle>
            <CardDescription className="text-xs">Subscription + active DB connector</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="outline">Professional · Trial</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2">
              <span className="text-muted-foreground">Trial ends</span>
              <span className="font-semibold">in 9 days</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-2">
              <span className="text-muted-foreground">Active DB</span>
              <span className="font-mono font-semibold text-secondary">sqlite</span>
            </div>
            <Button variant="outline" className="w-full" onClick={() => toast.info("Open billing")}>
              Manage in Billing →
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Danger zone */}
      <Card className="mt-4 border-red-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" /> Danger zone
          </CardTitle>
          <CardDescription className="text-xs">Irreversible tenant-level actions</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Delete tenant</p>
            <p className="text-[11px] text-muted-foreground">
              Permanently delete the tenant, all jobs, audit events, and users. This cannot be undone.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete tenant
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action is irreversible. All {15} jobs, audit events, providers, and users will be purged. Requires dual authorization and an audit-trail entry.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => toast.error("Deletion blocked", { description: "Demo tenants cannot be deleted." })}
                >
                  Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

function FlagRow({
  title, desc, checked, onCheckedChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-2.5">
      <div>
        <p className="text-[12px] font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
