/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";
import { createPrismaMarketplaceReservationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-reservation.repository";
import { expireMarketplaceCheckoutReservation } from "@/lib/marketplace-checkout/inventory-reservation.service";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
const candidates = await (prisma as any).marketplaceInventoryReservation.findMany({ where: { status: "ACTIVE", expiresAt: { lte: new Date() } }, orderBy: { expiresAt: "asc" }, take: limit, select: { checkoutId: true, publicReference: true } });
assertMarketplaceCheckoutProductionReady("RESERVATION");
const repository = createPrismaMarketplaceReservationRepository();
for (const candidate of candidates) {
  const reservation = await repository.findActiveReservation(candidate.checkoutId);
  if (reservation) await expireMarketplaceCheckoutReservation(repository, reservation, new Date(), `marketplace-expiry:${candidate.publicReference}`);
  console.log(JSON.stringify({ reservationReference: candidate.publicReference, operation: "expireMarketplaceCheckoutReservation" }));
}
