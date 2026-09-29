"use client";
// MedFlow — Billing (subscription + usage + plans + invoices).

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  CreditCard, DollarSign, FileStack, RefreshCw, Sparkles, TrendingUp, Zap,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/medflow/useFetch";
import { SAAS_PLANS } from "@/lib/medflow/constants";
import { formatDateTime, formatRelative, usd } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionError, SectionLoading } from "./_shared";

interface BillingData {
  subscription: {
    planName?: string;
    status?: string;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
    audioMinutesLimit?: number;
    seats?: number;
    storageLimitGb?: number;
  } | null;
  usageRecords: Array<{
    id: string;
    audioMinutesUsed: number;
    jobsProcessed: number;
    createdAt: string;
  }>;
}

export function Billing() {
  const { data, loading, error, refresh } = useFetch<BillingData>("/api/medflow/billing");

  const usageTrend = useMemo(() => {
    return (data?.usageRecords ?? []).slice(0, 6).reverse().map((u, i) => ({
      day: `T-${6 - i}`,
      min: u.audioMinutesUsed,
      jobs: u.jobsProcessed,
    }));
  }, [data]);

  if (loading) return (
    <div>
      <PageHeader title="Billing" description="Subscription, usage meters, and invoices." icon={CreditCard} />
      <SectionLoading rows={4} />
    </div>
  );
  if (error || !data) return (
    <div>
      <PageHeader title="Billing" description="Subscription, usage meters, and invoices." icon={CreditCard} />
      <SectionError message={error ?? "Unknown"} onRetry={refresh} />
    </div>
  );

  const sub = data.subscription;
  const plan = SAAS_PLANS.find(p => p.name === sub?.planName) ?? SAAS_PLANS[1];
  const usage = data.usageRecords[0];
  const audioUsed = usage?.audioMinutesUsed ?? 0;
  const audioLimit = sub?.audioMinutesLimit ?? plan.audioMinutes;
  const pctUsed = audioLimit > 0 ? Math.min(100, (audioUsed / audioLimit) * 100) : 0;

  // Mock invoices
  const invoices = [
    { id: "INV-2024-010", amount: usd(plan.pricePerMonth), status: "Paid", date: "Sep 1, 2024" },
    { id: "INV-2024-009", amount: usd(plan.pricePerMonth), status: "Paid", date: "Aug 1, 2024" },
    { id: "INV-2024-008", amount: usd(plan.pricePerMonth * 0.8), status: "Paid", date: "Jul 1, 2024" },
  ];

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Subscription, usage meters, and invoices (Stripe-connected)."
        icon={CreditCard}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.info("Redirecting to Stripe…")}>
              Manage in Stripe
            </Button>
          </>
        }
      />

      {/* Current plan */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" /> {plan.name}
              </CardTitle>
              <CardDescription className="text-xs">{plan.target}</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] capitalize">
              {sub?.status ?? "trialing"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Price</p>
                <p className="text-lg font-bold">{usd(plan.pricePerMonth)}<span className="text-[11px] font-normal text-muted-foreground">/mo</span></p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Trial ends</p>
                <p className="text-[12px] font-semibold">{sub?.trialEndsAt ? formatRelative(sub.trialEndsAt) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Period end</p>
                <p className="text-[12px] font-semibold">{sub?.currentPeriodEnd ? formatDateTime(sub.currentPeriodEnd) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Seats</p>
                <p className="text-[12px] font-semibold">{sub?.seats ?? plan.seats}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage meters */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usage this period</CardTitle>
            <CardDescription className="text-xs">Metered consumption</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1"><FileStack className="h-3 w-3 text-secondary" /> Audio minutes</span>
                <span className="font-semibold">{audioUsed} / {audioLimit}</span>
              </div>
              <Progress value={pctUsed} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-secondary" /> Jobs processed</span>
                <span className="font-semibold">{usage?.jobsProcessed ?? 0}</span>
              </div>
              <Progress value={Math.min(100, (usage?.jobsProcessed ?? 0) / 100)} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-secondary" /> Storage (GB)</span>
                <span className="font-semibold">{audioUsed * 0.05} / {plan.storageGb}GB</span>
              </div>
              <Progress value={Math.min(100, (audioUsed * 0.05 / plan.storageGb) * 100)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage trend + invoice history */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-secondary" /> Usage trend
            </CardTitle>
            <CardDescription className="text-xs">Audio minutes per period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="billGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1ABC9C" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#1ABC9C" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e2eee9" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #d4e6e0", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="min" stroke="#0B5345" strokeWidth={2} fill="url(#billGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Invoice history</CardTitle>
            <CardDescription className="text-xs">Last 3 invoices</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <EmptyState icon={CreditCard} message="No invoices yet." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Invoice</TableHead>
                    <TableHead className="text-[11px]">Date</TableHead>
                    <TableHead className="text-[11px]">Amount</TableHead>
                    <TableHead className="text-[11px]">Status</TableHead>
                    <TableHead className="text-[11px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv, i) => (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: i * 0.04 }}
                      className="hover:bg-muted/40"
                    >
                      <TableCell className="font-mono text-[11px] font-semibold">{inv.id}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{inv.date}</TableCell>
                      <TableCell className="text-[11px] font-semibold">{inv.amount}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => toast.info(`Downloading ${inv.id}.pdf`)}>
                          <DollarSign className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Plan comparison</CardTitle>
          <CardDescription className="text-xs">Upgrade or downgrade at any time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {SAAS_PLANS.map(p => {
              const isCurrent = p.name === plan.name;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className={cn("h-full", p.highlight && "ring-2 ring-secondary")}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        {p.name}
                        {isCurrent && <Badge className="text-[10px]">Current</Badge>}
                      </CardTitle>
                      <CardDescription className="text-[11px]">{p.target}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-3 text-2xl font-extrabold">
                        {p.pricePerMonth === 0 ? "Custom" : usd(p.pricePerMonth)}
                        {p.pricePerMonth > 0 && <span className="text-[11px] font-normal text-muted-foreground">/mo</span>}
                      </p>
                      <ul className="mb-3 space-y-1 text-[11px]">
                        {p.features.slice(0, 4).map(f => (
                          <li key={f} className="flex items-start gap-1.5 text-foreground/80">
                            <span className="text-emerald-500">✓</span> {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        className="w-full"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent}
                        onClick={() => toast.info(`Upgrading to ${p.name}…`, { description: "Stripe checkout will open." })}
                      >
                        {isCurrent ? "Current plan" : p.pricePerMonth === 0 ? "Contact sales" : `Upgrade to ${p.name}`}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
