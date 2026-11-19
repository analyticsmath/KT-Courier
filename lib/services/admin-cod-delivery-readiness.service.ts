import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import type { AuthenticatedUser } from "@/types/domain";

/** Financial detail is visible only to active administrators with cash authority. */
export async function getAdminCodDeliveryReadiness(actor: AuthenticatedUser, orderId: string) {
  if (actor.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(actor.role) ||
      !await hasPermission({ userId: actor.id, role: actor.role, permissionKey: PERMISSIONS.COD_OPERATIONS_MANAGE })) return null;
  const cash = await prisma.cashOnDelivery.findUnique({ where: { orderId }, select: {
    publicReference: true, status: true, digitalRequired: true, digitalPaid: true,
    cashObligation: true, cashCollected: true, collectorDriverId: true,
    order: { select: { currentDriverProfileId: true } },
  } });
  if (!cash) return null;
  return {
    reference: cash.publicReference,
    status: cash.status,
    digitalRequired: cash.digitalRequired.toFixed(2),
    digitalPaid: cash.digitalPaid.toFixed(2),
    cashObligation: cash.cashObligation.toFixed(2),
    cashCollected: cash.cashCollected.toFixed(2),
    cashOutstanding: Prisma.Decimal.max(cash.cashObligation.sub(cash.cashCollected), 0).toFixed(2),
    driverId: cash.collectorDriverId ?? cash.order.currentDriverProfileId,
  };
}
