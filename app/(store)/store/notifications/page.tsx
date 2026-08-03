/* eslint-disable @typescript-eslint/no-explicit-any -- notification inbox delegates are generated in a later persistence phase. */
import { redirect } from "next/navigation";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreNotificationInbox } from "@/components/protected-v2/store/StoreNotificationInbox";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export default async function StoreNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const notifications = await (prisma as any).notificationInboxItem.findMany({ where: { ownerUserId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, title: true, body: true, state: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 });
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Store account" title="Notifications" description="Store-owned account and service updates from the existing notification inbox." /><StoreNotificationInbox notifications={notifications} /></ProtectedPageFrame>;
}
