import Link from "next/link";
import { AdminAlertsConsole } from "@/components/admin/AdminAlertsConsole";
import { ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listAdminAlertOverview } from "@/lib/notifications/admin-alert-dispatch.service";

export const dynamic = "force-dynamic";

export default async function AdminNotificationAlertsPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.NOTIFICATION_AUDIT_READ);
  const [overview, canEditRecipients, canRetryDeliveries] = await Promise.all([
    listAdminAlertOverview({ limit: 80 }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.SETTINGS_UPDATE }),
    hasPermission({
      userId: user.id,
      role: user.role,
      permissionKey: PERMISSIONS.NOTIFICATION_DELIVERY_RETRY,
    }),
  ]);

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Notification administration"
        title="Admin & SuperAdmin parcel alerts"
        description="Manage verified Admin and SuperAdmin email alert recipients, inspect source-backed parcel/payment/COD alerts, and retry failed deliveries."
        breadcrumbs={[
          { label: "Notifications", href: "/admin/notifications" },
          { label: "Admin alerts" },
        ]}
        actions={
          <Link className="eo-inline-action" href="/admin/notifications">
            Back to notification operations
          </Link>
        }
      />
      <AdminAlertsConsole
        initialRecipients={overview.recipients}
        events={overview.events}
        deliveries={overview.deliveries}
        counts={overview.counts}
        canEditRecipients={canEditRecipients}
        canRetryDeliveries={canRetryDeliveries}
      />
    </ProtectedPageFrame>
  );
}
