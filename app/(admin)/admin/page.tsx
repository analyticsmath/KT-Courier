import type { Metadata } from "next";
import { AdminCommandCentre } from "@/components/protected-v2/admin/AdminCommandCentre";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getAdminDashboardData } from "@/lib/services/admin-dashboard.service";
import { getDispatchBoardData } from "@/lib/services/admin-dispatch.service";
import { listPickupExceptions } from "@/lib/services/admin-pickup-operations.service";
import { listDeliveryExceptions } from "@/lib/services/admin-delivery-exceptions.service";

export const metadata: Metadata = { title: "Operations desk" };

export default async function AdminDashboardPage() {
  await requireAdminPagePermission(PERMISSIONS.ADMIN_DASHBOARD_READ);

  const [dashboard, dispatch, pickupExceptions, deliveryExceptions] = await Promise.all([
    getAdminDashboardData(),
    getDispatchBoardData(),
    listPickupExceptions({ page: 1, pageSize: 4 }),
    listDeliveryExceptions({ page: 1, pageSize: 4 }),
  ]);

  const recentExceptions = [
    ...pickupExceptions.data.map((exception) => ({
      id: exception.id,
      orderId: exception.orderId,
      orderNumber: exception.orderNumber,
      occurredAt: exception.occurredAt,
      label: exception.failureReasonLabel ?? "Pickup failure recorded",
      source: "pickup" as const,
    })),
    ...deliveryExceptions.data.map((exception) => ({
      id: exception.id,
      orderId: exception.orderId,
      orderNumber: exception.orderNumber,
      occurredAt: exception.occurredAt,
      label: exception.exceptionReasonLabel ?? exception.eventType.replaceAll("_", " "),
      source: "delivery" as const,
    })),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime() || left.id.localeCompare(right.id)).slice(0, 6);

  return <AdminCommandCentre dashboard={dashboard} dispatch={dispatch} exceptionCount={pickupExceptions.total + deliveryExceptions.total} recentExceptions={recentExceptions} />;
}
