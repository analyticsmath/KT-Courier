import { ParcelCondition } from "@/types/db";
import { prisma } from "@/lib/db/prisma";
import { ExistingPhaseFinancialAdjustmentAuthority } from "@/lib/store-orders/financial-adjustment-composition";
import type { StoreOrderDeliveryAuthority, StoreOrderDependencies, StoreOrderPickupAuthority } from "@/lib/store-orders/contracts";
import { assertStoreOrderProductionReady, type StoreOrderProductionOperation } from "@/lib/store-orders/production-lock";
import { createMarketplaceCourierOrderFromFrozenEvidence } from "@/lib/services/marketplace-courier-order.service";
import { scheduleMarketplaceDispatchEligibility } from "@/lib/services/marketplace-dispatch-eligibility.service";
import { completePickup } from "@/lib/services/pickup-custody.service";
import { StoreOrderError } from "@/lib/store-orders/errors";

/** Concrete bridge over the existing courier `Order` aggregate and Phase 7 boundary. */
export class ExistingCourierOrderMarketplaceBridge implements StoreOrderDeliveryAuthority {
  async createCourierOrder(input: Readonly<{ storeOrderReference: string; deliveryQuoteReference: string; deliveryQuoteVersion: string; operationId: string }>) {
    const created = await createMarketplaceCourierOrderFromFrozenEvidence(input);
    return Object.freeze({ courierOrderId: created.courierOrderId, courierOrderReference: created.courierOrderReference });
  }

  async scheduleDispatch(input: Readonly<{ storeOrderReference: string; courierOrderId: string; expectedReadyAt: Date; operationId: string }>) {
    const bridges = prisma as unknown as { marketplaceStoreOrderDeliveryBridge?: { findFirst: (args: unknown) => Promise<{ deliveryQuoteReference: string | null } | null> } };
    const bridge = await bridges.marketplaceStoreOrderDeliveryBridge?.findFirst({ where: { courierOrderId: input.courierOrderId }, select: { deliveryQuoteReference: true } });
    if (!bridge?.deliveryQuoteReference) throw new StoreOrderError("STORE_ORDER_DELIVERY_QUOTE_MISSING", "Frozen delivery quote evidence is unavailable for Phase 7 scheduling.");
    const dispatchEvidence = await scheduleMarketplaceDispatchEligibility({ ...input, deliveryQuoteReference: bridge.deliveryQuoteReference });
    return Object.freeze({ dispatchEvidence });
  }
}

/** Concrete composition over the existing Phase 8 pickup-custody transition. */
export class ExistingPhase8MarketplacePickupAuthority implements StoreOrderPickupAuthority {
  async completeCanonicalPickup(input: Readonly<{ assignmentId: string; assignmentVersion: number; driverProfileId: string; driverUserId: string; operationId: string; packageCount: number }>): Promise<void> {
    const assignment = await prisma.orderAssignment.findFirst({ where: { id: input.assignmentId, driverProfileId: input.driverProfileId, status: "ACCEPTED" }, include: { order: { select: { parcelCount: true } }, driverProfile: { select: { userId: true, status: true } } } });
    if (!assignment || assignment.driverProfile.userId !== input.driverUserId || assignment.driverProfile.status !== "ACTIVE" || assignment.order.parcelCount !== input.packageCount) throw new StoreOrderError("STORE_ORDER_DRIVER_ASSIGNMENT_INVALID", "Active Phase 8 assignment ownership or package-count evidence is invalid.");
    const result = await completePickup(input.assignmentId, input.driverProfileId, input.driverUserId, { operationId: input.operationId, assignmentVersion: input.assignmentVersion, parcelCount: input.packageCount, parcelCondition: ParcelCondition.NOT_RECORDED, confirmPickup: true, publicNote: "Marketplace store handoff verified." });
    if (!result.ok) throw new StoreOrderError("STORE_ORDER_CANONICAL_PICKUP_FAILED", result.error);
  }
}

/**
 * Resolve concrete services before the production source lock. This keeps the
 * lock a consolidated-validation gate, never an `ADAPTER_NOT_IMPLEMENTED`
 * placeholder.
 */
export function resolveStoreOrderProductionComposition(): Required<StoreOrderDependencies> {
  return Object.freeze({
    financialAuthority: new ExistingPhaseFinancialAdjustmentAuthority(),
    deliveryAuthority: new ExistingCourierOrderMarketplaceBridge(),
    pickupAuthority: new ExistingPhase8MarketplacePickupAuthority(),
  });
}

export function resolveAndAssertStoreOrderOperation(operation: StoreOrderProductionOperation) {
  const composition = resolveStoreOrderProductionComposition();
  assertStoreOrderProductionReady(operation);
  return composition;
}
