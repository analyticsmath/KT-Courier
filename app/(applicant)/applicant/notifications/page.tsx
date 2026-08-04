import { NotificationCentre } from "@/components/notifications/NotificationCentre";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { requireAuth } from "@/lib/auth/guards";

export default async function NotificationsPage() {
  const user = await requireAuth();
  return <ProtectedPageFrame><NotificationCentre userId={user.id} title="Application notifications" /></ProtectedPageFrame>;
}
