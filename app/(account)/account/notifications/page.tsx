import { NotificationCentre } from "@/components/notifications/NotificationCentre";
import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Notifications" };

export default async function NotificationsInboxPage() {
  const user = await getCurrentUser();
  return (
    <CustomerPage eyebrow="Account updates" title="Notifications" description="Delivery and account updates from your canonical inbox.">
      <NotificationCentre userId={user!.id} title="Account notifications" />
    </CustomerPage>
  );
}
