import { NotificationAdministrationOverview } from "@/components/protected-v2/notification-admin/NotificationAdministrationPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

export default async function AdminNotificationsPage() {
  await requireAdminPagePermission(PERMISSIONS.NOTIFICATION_AUDIT_READ);
  return <NotificationAdministrationOverview />;
}
