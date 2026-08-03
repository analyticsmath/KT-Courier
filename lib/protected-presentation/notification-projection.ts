/* eslint-disable @typescript-eslint/no-explicit-any -- generated notification model is intentionally deferred in this workspace. */
import { prisma } from "@/lib/db/prisma";

/** Minimal, presentation-safe notification data for the protected shell. */
export async function getProtectedNotificationProjection(userId: string, href: string): Promise<{
  unreadCount: number;
  href: string;
}> {
  const unreadCount = await (prisma as any).notificationInboxItem.count({
    where: {
      ownerUserId: userId,
      state: "UNREAD",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  return { unreadCount, href };
}
