import { NotificationAdministrationPage } from "@/components/protected-v2/notification-admin/NotificationAdministrationPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page() { await requireAdminPagePermission(PERMISSIONS.NOTIFICATION_PROVIDER_STATUS_READ); return <NotificationAdministrationPage kind="provider" />; }
