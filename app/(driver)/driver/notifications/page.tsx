import type { Metadata } from "next";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Driver notifications" };

export default async function DriverNotificationsPage() {
  const user = await requireRole(UserRole.DRIVER);
  return <ProtectedPageFrame><NotificationCentre userId={user.id} title="Driver notifications" /></ProtectedPageFrame>;
}
