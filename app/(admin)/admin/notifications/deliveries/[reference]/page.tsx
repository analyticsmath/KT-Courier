import { NotificationAdministrationPage } from "@/components/protected-v2/notification-admin/NotificationAdministrationPage";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
export default async function Page({ params }: { params: Promise<{ reference: string }> }) { await requireAdminPagePermission(PERMISSIONS.NOTIFICATION_DELIVERY_READ); return <NotificationAdministrationPage kind="delivery" reference={(await params).reference} />; }
