import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const sub = await db.subscription.findFirst();
  const usage = await db.usageRecord.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    connected: false,
    connect_url: "/settings#stripe",
    message: "Connect your Stripe account to activate live billing. Demo data shown below.",
    subscription: sub ? {
      plan: sub.planTier, status: sub.status, monthly_limit: sub.monthlyAudioMinutesLimit,
      seats_limit: sub.seatsLimit, current_period_end: sub.currentPeriodEnd,
      stripe_customer_id: sub.stripeCustomerId, stripe_subscription_id: sub.stripeSubscriptionId,
      portal_url: "https://billing.stripe.com/p/session_demo_cardinal",
      checkout_url: "https://checkout.stripe.com/c/pay/cs_demo_cardinal_health",
    } : null,
    usage: usage ? {
      audio_minutes: usage.audioMinutes, jobs: usage.jobsProcessed, ai_minutes: usage.aiMinutes,
      storage_gb: usage.storageUsedGb, cost_usd: usage.costUsd, period: `${usage.periodStart?.toISOString?.() ?? usage.periodStart} → ${usage.periodEnd?.toISOString?.() ?? usage.periodEnd}`,
    } : null,
    invoices: [
      { id: "in_001", number: "INV-2026-001", date: "2026-09-01", amount: 921.60, status: "paid", pdf: "#" },
      { id: "in_002", number: "INV-2026-002", date: "2026-08-01", amount: 874.20, status: "paid", pdf: "#" },
      { id: "in_003", number: "INV-2026-003", date: "2026-07-01", amount: 612.40, status: "paid", pdf: "#" },
      { id: "in_004", number: "INV-2026-004", date: "2026-06-01", amount: 548.00, status: "paid", pdf: "#" },
      { id: "in_005", number: "INV-2026-005", date: "2026-05-01", amount: 491.80, status: "paid", pdf: "#" },
    ],
    payment_methods: [
      { id: "pm_visa", brand: "Visa", last4: "4242", exp_month: 12, exp_year: 2027, is_default: true },
      { id: "pm_amex", brand: "Amex", last4: "0005", exp_month: 8, exp_year: 2026, is_default: false },
    ],
    dunning: { failed_payments: 0, retry_count: 0, grace_period_days: 7, status: "none" },
  });
}
