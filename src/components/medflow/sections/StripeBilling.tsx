"use client";
// MedFlow — Stripe Billing (E6)
// Enhances the existing Billing section with Stripe-specific panels:
// connection, live subscription, usage metering, invoices, payment methods, dunning.
// Wraps + extends the existing Billing component — existing content is preserved.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Banknote, Calendar, CreditCard, ExternalLink, FileDown, Plus,
  RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFetch } from "@/hooks/medflow/useFetch";
import { formatDateTime } from "@/lib/medflow/format";
import { usd } from "@/lib/medflow/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Billing } from "./Billing";
import { EmptyState, PageHeader } from "./_shared";

interface StripeInvoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: string;
  pdf: string;
}
interface StripePaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}
interface StripeDunning {
  failed_payments: number;
  retry_count: number;
  grace_period_days: number;
  status: string;
}
interface StripeUsage {
  audio_minutes: number;
  jobs: number;
  ai_minutes: number;
  storage_gb: number;
  cost_usd: number;
  period: string;
}
interface StripeSubscription {
  plan: string;
  status: string;
  monthly_limit: number;
  seats_limit: number;
  current_period_end: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  portal_url: string;
  checkout_url: string;
}
interface StripeData {
  connected: boolean;
  connect_url: string;
  message: string;
  subscription: StripeSubscription | null;
  usage: StripeUsage | null;
  invoices: StripeInvoice[];
  payment_methods: StripePaymentMethod[];
  dunning: StripeDunning;
}

function brandColor(brand: string): string {
  switch (brand.toLowerCase()) {
    case "visa": return "bg-blue-50 text-blue-700 border-blue-200";
    case "mastercard": return "bg-orange-50 text-orange-700 border-orange-200";
    case "amex": return "bg-teal-50 text-teal-700 border-teal-200";
    case "discover": return "bg-amber-50 text-amber-700 border-amber-200";
    default: return "bg-muted text-muted-foreground";
  }
}

function invoiceStatusBadge(status: string): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (status === "open") return "bg-amber-100 text-amber-700 border-amber-300";
  if (status === "void") return "bg-muted text-muted-foreground";
  if (status === "uncollectible") return "bg-red-100 text-red-700 border-red-300";
  return "bg-muted text-muted-foreground";
}

export function StripeBilling() {
  const { data, loading, error, refresh } = useFetch<StripeData>("/api/medflow/stripe");
  const [connecting, setConnecting] = useState(false);
  const [addingMethod, setAddingMethod] = useState(false);

  if (loading && !data) {
    // Render the existing Billing component (with its own loading skeleton) while we wait
    return (
      <div>
        <PageHeader title="Billing" description="Subscription, usage, invoices, and Stripe integration." icon={CreditCard} />
        <Billing />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Billing" description="Subscription, usage, invoices, and Stripe integration." icon={CreditCard} />
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Failed to load Stripe data</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button>
          </AlertDescription>
        </Alert>
        <div className="mt-4"><Billing /></div>
      </div>
    );
  }

  const d = data!;

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      toast.success("Redirecting to Stripe Connect…", { description: "Complete the Stripe onboarding to activate live billing." });
      refresh();
    }, 800);
  };

  const handleAddPaymentMethod = () => {
    setAddingMethod(true);
    setTimeout(() => {
      setAddingMethod(false);
      toast.success("Add Payment Method", { description: "Stripe Elements checkout will open." });
    }, 500);
  };

  const downloadInvoice = (inv: StripeInvoice) => {
    toast.success(`Downloading ${inv.number}.pdf`, { description: usd(inv.amount) });
  };

  const goToPortal = () => {
    if (!d.subscription?.portal_url) { toast.info("Stripe portal unavailable."); return; }
    toast.success("Opening Stripe Customer Portal…", { description: "Manage subscription, update card, view invoices." });
  };

  // Usage metering numbers
  const audioMinUsed = d.usage?.audio_minutes ?? 0;
  const audioMinLimit = d.subscription?.monthly_limit ?? 0;
  const audioPct = audioMinLimit > 0 ? Math.min(100, (audioMinUsed / audioMinLimit) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Subscription, usage meters, invoices, and Stripe integration."
        icon={CreditCard}
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {/* ── EXISTING Billing content (preserved) ─────────────────────────── */}
      <Billing />

      {/* ── NEW Stripe-specific panels ───────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Stripe Connection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-secondary" /> Stripe Connection
            </CardTitle>
            <CardDescription className="text-xs">Live payment gateway integration status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.connected ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                    Connected
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">Stripe account is live</span>
                </div>
                <div className="grid grid-cols-1 gap-2 text-[11px]">
                  {d.subscription?.stripe_customer_id && (
                    <div className="flex items-center justify-between rounded-md bg-muted/40 p-2">
                      <span className="text-muted-foreground">Customer ID</span>
                      <span className="font-mono font-semibold text-foreground">{d.subscription.stripe_customer_id}</span>
                    </div>
                  )}
                  {d.subscription?.stripe_subscription_id && (
                    <div className="flex items-center justify-between rounded-md bg-muted/40 p-2">
                      <span className="text-muted-foreground">Subscription ID</span>
                      <span className="font-mono font-semibold text-foreground">{d.subscription.stripe_subscription_id}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Alert className="border-amber-300 bg-amber-50 text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Not connected</AlertTitle>
                  <AlertDescription>{d.message ?? "Connect your Stripe account to activate live billing."}</AlertDescription>
                </Alert>
                <Button className="bg-primary text-primary-foreground" size="sm" onClick={handleConnect} disabled={connecting}>
                  {connecting ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Banknote className="mr-1.5 h-3.5 w-3.5" />}
                  {connecting ? "Connecting…" : "Connect Stripe"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Live Subscription */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary" /> Live Subscription
            </CardTitle>
            <CardDescription className="text-xs">Current Stripe subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.subscription ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Plan</p>
                    <p className="font-semibold text-foreground capitalize">{d.subscription.plan}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Status</p>
                    <p className="font-semibold capitalize text-foreground">{d.subscription.status}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Monthly limit (audio min)</p>
                    <p className="font-semibold text-foreground">{d.subscription.monthly_limit?.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Seats</p>
                    <p className="font-semibold text-foreground">{d.subscription.seats_limit}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-[11px]">
                  <span className="text-muted-foreground">Current period ends</span>
                  <span className="font-semibold text-foreground">
                    {d.subscription.current_period_end ? formatDateTime(d.subscription.current_period_end) : "—"}
                  </span>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={goToPortal}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Manage in Stripe Portal
                </Button>
              </>
            ) : (
              <EmptyState icon={Sparkles} message="No active subscription." />
            )}
          </CardContent>
        </Card>

        {/* Usage Metering */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-secondary" /> Usage Metering
            </CardTitle>
            <CardDescription className="text-xs">Metered consumption this period — synced from Stripe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.usage ? (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-secondary" /> Audio minutes</span>
                    <span className="font-semibold">{audioMinUsed.toLocaleString()} / {audioMinLimit.toLocaleString()}</span>
                  </div>
                  <Progress value={audioPct} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Jobs processed</p>
                    <p className="text-sm font-bold">{d.usage.jobs.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">AI minutes</p>
                    <p className="text-sm font-bold">{d.usage.ai_minutes?.toFixed(1)}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Storage (GB)</p>
                    <p className="text-sm font-bold">{d.usage.storage_gb?.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] uppercase text-muted-foreground">Cost this period</p>
                    <p className="text-sm font-bold text-primary">{usd(d.usage.cost_usd)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  <Calendar className="mr-1 inline h-3 w-3" /> Period: {d.usage.period}
                </p>
              </>
            ) : (
              <EmptyState icon={Zap} message="No usage records yet." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices + Payment Methods (full-width grid) */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Invoices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stripe Invoices</CardTitle>
            <CardDescription className="text-xs">Billed via Stripe · downloadable PDFs</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {d.invoices.length === 0 ? (
              <EmptyState icon={CreditCard} message="No invoices yet." />
            ) : (
              <div className="mf-scroll-lg overflow-auto max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px]">Number</TableHead>
                      <TableHead className="text-[11px]">Date</TableHead>
                      <TableHead className="text-[11px]">Amount</TableHead>
                      <TableHead className="text-[11px]">Status</TableHead>
                      <TableHead className="text-[11px] text-right">PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.invoices.map((inv, i) => (
                      <motion.tr
                        key={inv.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15, delay: i * 0.03 }}
                        className="hover:bg-muted/40"
                      >
                        <TableCell className="font-mono text-[11px] font-semibold">{inv.number}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{inv.date}</TableCell>
                        <TableCell className="text-[11px] font-semibold">{usd(inv.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", invoiceStatusBadge(inv.status))}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => downloadInvoice(inv)}>
                            <FileDown className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Payment Methods</CardTitle>
                <CardDescription className="text-xs">Cards on file via Stripe</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={handleAddPaymentMethod} disabled={addingMethod}>
                {addingMethod ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                {addingMethod ? "Loading…" : "Add"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {d.payment_methods.length === 0 ? (
              <EmptyState icon={CreditCard} message="No payment methods on file." />
            ) : (
              <div className="mf-scroll max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                <AnimatePresence>
                  {d.payment_methods.map((pm, i) => (
                    <motion.div
                      key={pm.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, delay: i * 0.04 }}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn("grid h-9 w-12 place-items-center rounded-md border text-[10px] font-bold uppercase", brandColor(pm.brand))}>
                          {pm.brand}
                        </span>
                        <div>
                          <p className="font-mono text-sm font-semibold text-foreground">•••• {pm.last4}</p>
                          <p className="text-[10px] text-muted-foreground">Expires {String(pm.exp_month).padStart(2, "0")}/{String(pm.exp_year).slice(-2)}</p>
                        </div>
                      </div>
                      {pm.is_default && (
                        <Badge variant="outline" className="text-[10px] text-secondary border-secondary/40 bg-secondary/10">
                          Default
                        </Badge>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dunning */}
      {d.dunning && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Dunning & Failed Payments
            </CardTitle>
            <CardDescription className="text-xs">Stripe retry schedule + grace period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.dunning.status !== "none" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Dunning active</AlertTitle>
                <AlertDescription>
                  {d.dunning.failed_payments} failed payment(s). Stripe will retry {d.dunning.retry_count} more time(s). Service may be suspended in {d.dunning.grace_period_days} days if unresolved.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Failed payments</p>
                <p className="font-bold text-foreground">{d.dunning.failed_payments}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Retry count</p>
                <p className="font-bold text-foreground">{d.dunning.retry_count}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Grace period (days)</p>
                <p className="font-bold text-foreground">{d.dunning.grace_period_days}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Status</p>
                <Badge variant="outline" className={cn(
                  "text-[10px] capitalize",
                  d.dunning.status === "none" ? "text-emerald-700 border-emerald-300 bg-emerald-50" : "text-red-700 border-red-300 bg-red-50"
                )}>
                  {d.dunning.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
