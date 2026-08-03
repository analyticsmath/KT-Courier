/* eslint-disable @typescript-eslint/no-explicit-any -- runtime Prisma generation is intentionally deferred. */
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";
import { createPrismaMarketplaceReservationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-reservation.repository";
import { holdReservationForUncertainPayment, releaseMarketplaceCheckoutReservation } from "@/lib/marketplace-checkout/inventory-reservation.service";

/** Canonical reservation reconciliation: pending and unknown payments are held, never released. */
export async function reconcileMarketplaceReservation(reference: string, operationId: string): Promise<{ action: "HELD" | "RELEASED" | "NO_ACTION" }> {
  const reservation = await (prisma as any).marketplaceInventoryReservation.findUnique({ where: { publicReference: reference }, include: { payment: true, items: true } });
  if (!reservation) throw new MarketplaceCheckoutError("CHECKOUT_NOT_FOUND", "Marketplace reservation was not found.");
  const repository = createPrismaMarketplaceReservationRepository();
  const canonical = await repository.findActiveReservation(reservation.checkoutId);
  if (!canonical) return { action: "NO_ACTION" };
  const paymentStatus = reservation.payment?.status as string | undefined;
  assertMarketplaceCheckoutProductionReady("RESERVATION");
  if (["PENDING", "PROCESSING", "REQUIRES_ACTION", "UNKNOWN"].includes(paymentStatus ?? "")) {
    await holdReservationForUncertainPayment(repository, canonical, reservation.paymentId ?? "payment-unknown");
    return { action: "HELD" };
  }
  if (["FAILED", "CANCELLED", "EXPIRED"].includes(paymentStatus ?? "")) {
    await releaseMarketplaceCheckoutReservation(repository, { reservation: canonical, operationId, reason: "ADMIN_RECONCILIATION", paymentStatus, paymentOutcomeKnown: true });
    return { action: "RELEASED" };
  }
  return { action: "NO_ACTION" };
}
