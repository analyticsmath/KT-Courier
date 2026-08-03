import { prisma } from "@/lib/db/prisma";

/** Phase 7 composition boundary: schedules eligibility evidence only, never a driver. */
export async function scheduleMarketplaceDispatchEligibility(input: Readonly<{ courierOrderId: string; storeOrderReference: string; expectedReadyAt: Date; deliveryQuoteReference: string; operationId: string }>) {
  const order = await prisma.order.findUnique({ where: { id: input.courierOrderId }, select: { id: true, status: true, deliveryRegionId: true, scheduledFor: true } });
  if (!order || !["CONFIRMED", "PICKUP_SCHEDULED"].includes(order.status) || !order.deliveryRegionId) throw new Error("Canonical courier order is not eligible for Phase 7 dispatch scheduling.");
  return Object.freeze({ phase: "PHASE_7_DISPATCH_ELIGIBILITY", courierOrderId: order.id, serviceabilityEvidence: "FROZEN_PHASE6_QUOTE", deliveryQuoteReference: input.deliveryQuoteReference, expectedReadyAt: input.expectedReadyAt.toISOString(), operationId: input.operationId, driverSelected: false });
}
