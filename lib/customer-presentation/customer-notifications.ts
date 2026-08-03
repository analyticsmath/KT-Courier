/* eslint-disable @typescript-eslint/no-explicit-any -- notification model generation is intentionally deferred. */
import { prisma } from "@/lib/db/prisma";

/** A deliberately small server-side projection for the customer notification page. */
export async function listCustomerNotifications(userId: string) {
  const items = await (prisma as any).notificationInboxItem.findMany({
    where: { ownerUserId: userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, state: true, createdAt: true },
  });
  return items.map((item: { id: string; title: string; body: string; state: string; createdAt: Date }) => Object.freeze({
    id: item.id,
    title: item.title,
    body: item.body,
    unread: item.state === "UNREAD",
    createdAt: item.createdAt,
  }));
}
