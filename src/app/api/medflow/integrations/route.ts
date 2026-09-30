// Integrations + delivery destinations
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [integrations, deliveryDestinations] = await Promise.all([
    db.integrationConnection.findMany({ orderBy: { createdAt: "asc" } }),
    db.deliveryDestination.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({ integrations, deliveryDestinations });
}
