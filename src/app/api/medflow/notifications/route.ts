// Notifications list + mark read
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const notifications = await db.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { name: true, role: true } } },
  });
  return NextResponse.json({
    notifications: notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      readAt: n.readAt,
      recipient: n.user?.name ?? null,
      role: n.user?.role ?? null,
      createdAt: n.createdAt,
    })),
  });
}

// Mark a notification as read
export async function PATCH(req: Request) {
  const { id } = await req.json();
  await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
