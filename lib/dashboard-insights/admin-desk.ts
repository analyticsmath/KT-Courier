import "server-only";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { getDispatchBoardData } from "@/lib/services/admin-dispatch.service";
import { listPickupExceptions } from "@/lib/services/admin-pickup-operations.service";
import { listDeliveryExceptions } from "@/lib/services/admin-delivery-exceptions.service";
import { getAdminDashboardInsights } from "./admin-dashboard-insights";
import type { DashboardPeriod } from "./types";

/** Check domain permissions before querying; acquire no finance or governance data. */
export async function getAdminDesk(period: DashboardPeriod) {
  const user = await requireAdminPagePermission(PERMISSIONS.ADMIN_DASHBOARD_READ);
  const [ordersAllowed, dispatchAllowed, storesAllowed, regionsAllowed] = await Promise.all(
    [PERMISSIONS.ORDERS_READ, PERMISSIONS.DISPATCH_READ, PERMISSIONS.STORES_READ, PERMISSIONS.REGIONS_READ].map((permissionKey) => hasPermission({ userId: user.id, role: user.role, permissionKey })),
  );
  const [insight, attention, dispatch, pickup, delivery, pendingStores, regions] = await Promise.all([
    ordersAllowed ? getAdminDashboardInsights(period) : null,
    ordersAllowed ? prisma.order.findMany({
      where: { OR: [{ status: { in: ["PENDING", "FAILED", "DELIVERY_ATTEMPTED"] } }, { status: { in: ["CONFIRMED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT"] }, distanceMeters: null }] },
      select: { id: true, orderNumber: true, status: true, createdAt: true, pickupAddress: { select: { city: true } }, dropoffAddress: { select: { city: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 7,
    }) : null,
    dispatchAllowed ? getDispatchBoardData() : null,
    dispatchAllowed ? listPickupExceptions({ page: 1, pageSize: 4 }) : null,
    dispatchAllowed ? listDeliveryExceptions({ page: 1, pageSize: 4 }) : null,
    storesAllowed ? prisma.store.count({ where: { status: "PENDING" } }) : null,
    regionsAllowed ? prisma.deliveryRegion.findMany({ where: { active: true }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" }, take: 12 }) : null,
  ]);
  const exceptions = [
    ...(pickup?.data ?? []).map((row) => ({ id: row.id, orderId: row.orderId, orderNumber: row.orderNumber, occurredAt: row.occurredAt, label: row.failureReasonLabel ?? "Pickup failure recorded" })),
    ...(delivery?.data ?? []).map((row) => ({ id: row.id, orderId: row.orderId, orderNumber: row.orderNumber, occurredAt: row.occurredAt, label: row.exceptionReasonLabel ?? row.eventType.replaceAll("_", " ") })),
  ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id));
  return { insight, attention, dispatch, exceptions, exceptionCount: pickup && delivery ? pickup.total + delivery.total : null, pendingStores, regions, ordersAllowed };
}
export type AdminDesk = Awaited<ReturnType<typeof getAdminDesk>>;
