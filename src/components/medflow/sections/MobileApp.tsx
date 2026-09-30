"use client";
// MedFlow — Mobile Provider App (F2).
// Two-column layout: LEFT = platform tiles + features + security + usage +
// rollout; RIGHT = a phone mockup preview showing the provider app home
// screen (logo, greeting, microphone button, recent jobs, bottom nav).

import { motion } from "framer-motion";
import {
  Activity, Apple, Battery, CheckCircle2, Fingerprint, Lock, Mic,
  RefreshCw, ShieldCheck, Smartphone, Star, Wifi,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useFetch } from "@/hooks/medflow/useFetch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader, SectionError, SectionLoading, StatCard } from "./_shared";

interface MobileConfig {
  app_id: string;
  version: string;
  status: string;
  platforms: {
    ios: {
      version: string; min_ios: string; app_store_url: string;
      status: string; last_release: string; rating: number; rating_count: number;
    };
    android: {
      version: string; min_android: string; play_store_url: string;
      status: string; last_release: string; rating: number; rating_count: number;
    };
  };
  features: Record<string, boolean>;
  security: Record<string, boolean> & { min_session_timeout_min?: number };
  qr_download_url: string;
  deep_link_scheme: string;
  universal_link: string;
  push_notification_config: {
    provider: string; encryption: string; critical_alerts: boolean;
    quiet_hours_default: string;
  };
  usage_stats: {
    active_installations: number; monthly_active_users: number;
    avg_session_min: number; crashes_last_7d: number;
    crash_free_users_pct: number; top_feature_used: string;
    offline_sync_count_last_30d: number;
  };
  rollout: {
    current_release_pct: number; staged_rollout_enabled: boolean;
    next_version_in_review: string; next_version_features: string[];
  };
}

export function MobileApp() {
  const { data, loading, error, refresh } = useFetch<MobileConfig>("/api/medflow/mobile-config");

  if (loading) return (
    <div>
      <PageHeader title="Mobile Provider App" description="iOS + Android native app for providers to dictate on the go — biometric auth, offline mode, Apple Health/Google Fit sync." icon={Smartphone} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Mobile Provider App" description="iOS + Android native app for providers to dictate on the go — biometric auth, offline mode, Apple Health/Google Fit sync." icon={Smartphone} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  const ios = data.platforms.ios;
  const android = data.platforms.android;
  const usage = data.usage_stats;
  const rollout = data.rollout;

  return (
    <div>
      <PageHeader
        title="Mobile Provider App"
        description="iOS + Android native app for providers to dictate on the go — biometric auth, offline mode, Apple Health/Google Fit sync."
        icon={Smartphone}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT — config + stats */}
        <div className="space-y-4 lg:col-span-2">
          {/* Platforms */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4 text-secondary" /> Platforms
              </CardTitle>
              <CardDescription className="text-xs">App Store + Google Play distribution</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PlatformTile
                name="iOS"
                icon={Apple}
                version={ios.version}
                minOsLabel="Min iOS"
                minOs={ios.min_ios}
                rating={ios.rating}
                ratingCount={ios.rating_count}
                status={ios.status}
                lastRelease={ios.last_release}
                storeLabel="App Store"
                storeUrl={ios.app_store_url}
              />
              <PlatformTile
                name="Android"
                icon={Smartphone}
                version={android.version}
                minOsLabel="Min Android"
                minOs={android.min_android}
                rating={android.rating}
                ratingCount={android.rating_count}
                status={android.status}
                lastRelease={android.last_release}
                storeLabel="Google Play"
                storeUrl={android.play_store_url}
              />
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-secondary" /> Features
              </CardTitle>
              <CardDescription className="text-xs">Capability toggles per release channel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.features).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                    <span className="text-[11px] font-medium capitalize text-foreground">{key.replace(/_/g, " ")}</span>
                    <Switch
                      checked={val}
                      onCheckedChange={() => toast.success("Feature updated", { description: `${key}: ${!val ? "ON" : "OFF"}` })}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-secondary" /> Security
              </CardTitle>
              <CardDescription className="text-xs">Hardened mobile security posture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(data.security).filter(([k]) => k !== "min_session_timeout_min").map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5">
                    <CheckCircle2 className={cn("h-3.5 w-3.5", val ? "text-emerald-600" : "text-red-500")} />
                    <span className="text-[11px] font-medium capitalize text-foreground">{key.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Min session timeout: </span>
                <span className="text-[11px] font-bold text-foreground">{data.security.min_session_timeout_min} min</span>
              </div>
            </CardContent>
          </Card>

          {/* Usage Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon={Smartphone} label="Active Installations" value={usage.active_installations} accent="text-secondary" sub="devices" />
            <StatCard icon={Activity} label="MAU" value={usage.monthly_active_users} accent="text-secondary" sub="monthly active" />
            <StatCard icon={Activity} label="Avg Session" value={`${usage.avg_session_min.toFixed(1)}m`} accent="text-amber-600" sub="per session" />
            <StatCard icon={Activity} label="Crashes 7d" value={usage.crashes_last_7d} accent="text-red-600" sub="last week" deltaTone="down" delta={`${usage.crashes_last_7d}`} />
            <StatCard icon={CheckCircle2} label="Crash-Free" value={`${usage.crash_free_users_pct.toFixed(1)}%`} accent="text-emerald-600" sub="of users" deltaTone="up" delta={`${usage.crash_free_users_pct}%`} />
            <StatCard icon={RefreshCw} label="Offline Syncs" value={usage.offline_sync_count_last_30d} accent="text-secondary" sub="last 30d" />
          </div>

          {/* Rollout */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-secondary" /> Rollout
              </CardTitle>
              <CardDescription className="text-xs">Release channel + staged rollout status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">Current release rollout</span>
                  <span className="font-mono text-[11px] font-bold text-foreground">{rollout.current_release_pct}%</span>
                </div>
                <Progress value={rollout.current_release_pct} className="h-2" />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="text-[11px] text-muted-foreground">Next version in review</span>
                <span className="font-mono text-[12px] font-bold text-foreground">{rollout.next_version_in_review}</span>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next version features</p>
                <div className="flex flex-wrap gap-1">
                  {rollout.next_version_features.map(f => (
                    <Badge key={f} variant="outline" className="text-[10px] border-secondary/40 text-secondary">{f}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Phone mockup preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4 text-secondary" /> App Preview
              </CardTitle>
              <CardDescription className="text-xs">v{data.version} · {data.status.replace(/_/g, " ")}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <PhoneMockup version={data.version} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PlatformTile({
  name, icon: Icon, version, minOsLabel, minOs, rating, ratingCount,
  status, lastRelease, storeLabel, storeUrl,
}: {
  name: string;
  icon: typeof Apple;
  version: string;
  minOsLabel: string;
  minOs: string;
  rating: number;
  ratingCount: number;
  status: string;
  lastRelease: string;
  storeLabel: string;
  storeUrl: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <Badge variant="outline" className={cn("text-[10px]", status === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700")}>
              {status}
            </Badge>
          </div>
          <p className="mt-2 text-base font-bold text-foreground">{name}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
            <div>
              <span className="text-muted-foreground">Version</span>
              <p className="font-mono font-bold text-foreground">{version}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{minOsLabel}</span>
              <p className="font-mono font-bold text-foreground">{minOs}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Rating</span>
              <p className="flex items-center gap-1 font-bold text-foreground">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {rating.toFixed(1)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Reviews</span>
              <p className="font-mono font-bold text-foreground">{ratingCount.toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Last release: {lastRelease}</p>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-3 w-full text-[11px]"
          >
            <a href={storeUrl} target="_blank" rel="noreferrer">
              <Smartphone className="mr-1 h-3 w-3" /> {storeLabel}
            </a>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PhoneMockup({ version }: { version: string }) {
  return (
    <div className="relative" style={{ width: 280, height: 560 }}>
      {/* Phone frame */}
      <div
        className="absolute inset-0 rounded-[36px] border-[8px] border-[#17202A] bg-[#17202A] shadow-2xl"
      >
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#17202A]" />
        {/* Screen */}
        <div className="absolute inset-0 overflow-hidden rounded-[28px] bg-[#E8F8F5]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[9px] font-bold text-[#17202A]">
            <span>9:41</span>
            <div className="flex items-center gap-0.5">
              <Wifi className="h-2.5 w-2.5" />
              <Battery className="h-3 w-3" />
            </div>
          </div>

          {/* App header */}
          <div className="px-4 py-2" style={{ background: "#0B5345" }}>
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
                <Mic className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white">MedFlow</p>
                <p className="text-[8px] text-white/70">Provider · v{version}</p>
              </div>
              <Lock className="ml-auto h-3 w-3 text-white/80" />
            </div>
          </div>

          {/* Welcome */}
          <div className="px-4 py-3">
            <p className="text-[11px] font-bold text-[#0B5345]">Welcome back,</p>
            <p className="text-[14px] font-extrabold text-[#17202A]">Dr. Carter</p>
            <p className="mt-1 text-[9px] text-[#17202A]/60">You have 2 jobs awaiting review</p>
          </div>

          {/* Dictate button */}
          <div className="flex flex-col items-center py-3">
            <button
              className="grid h-20 w-20 place-items-center rounded-full shadow-lg"
              style={{ background: "#1ABC9C" }}
              aria-label="Dictate now"
            >
              <Mic className="h-8 w-8 text-white" />
            </button>
            <p className="mt-1 text-[10px] font-bold text-[#0B5345]">Dictate now</p>
          </div>

          {/* Recent jobs */}
          <div className="px-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#17202A]/60">Recent jobs</p>
            <div className="space-y-1.5">
              {[
                { num: "MF-2024-006", type: "Cardiology SOAP", status: "Awaiting review" },
                { num: "MF-2024-005", type: "H&P", status: "Editing" },
                { num: "MF-2024-004", type: "Discharge Summary", status: "Delivered" },
              ].map((j, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-[#17202A]/10 bg-white px-2 py-1.5">
                  <div>
                    <p className="font-mono text-[9px] font-bold text-[#0B5345]">{j.num}</p>
                    <p className="text-[9px] text-[#17202A]/70">{j.type}</p>
                  </div>
                  <span className="rounded-full bg-[#1ABC9C]/15 px-1.5 py-0.5 text-[8px] font-semibold text-[#0B5345]">{j.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="absolute bottom-0 left-0 right-0 grid grid-cols-4 border-t border-[#17202A]/10 bg-white px-2 py-2">
            <NavItem label="Home" active />
            <NavItem label="Jobs" />
            <NavItem label="Inbox" />
            <NavItem label="Profile" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("h-3 w-3 rounded", active ? "bg-[#0B5345]" : "bg-[#17202A]/30")} />
      <span className={cn("text-[8px] font-semibold", active ? "text-[#0B5345]" : "text-[#17202A]/50")}>{label}</span>
    </div>
  );
}
