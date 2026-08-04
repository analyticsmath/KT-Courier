import type { Metadata } from "next";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter notifications" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  return <ProtectedPageFrame><NotificationCentre userId={user.id} title="Promoter notifications" /></ProtectedPageFrame>;
}
