// Billing: subscription + usage + invoices
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [subscription, usageRecords] = await Promise.all([
    db.subscription.findFirst(),
    db.usageRecord.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  return NextResponse.json({ subscription, usageRecords });
}
