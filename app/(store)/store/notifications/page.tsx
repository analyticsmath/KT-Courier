import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { redirect } from "next/navigation";
import { NotificationCentre } from "@/components/notifications/NotificationCentre";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function StoreNotificationsPage() {
  await requireBusinessPage("/store/notifications");
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return (
    <ProtectedPageFrame>
      <NotificationCentre userId={user.id} title="Store notifications" />
    </ProtectedPageFrame>
  );
}
