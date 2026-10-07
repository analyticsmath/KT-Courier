import { prisma } from "@/lib/db/prisma";

/** Bounded read-only projection. Callers must enforce checkout-read authority. */
export async function listMarketplaceCheckoutAdminRecords() {
  const [checkouts, orders, reservations, settlements, reconciliationCases] = await Promise.all([
    prisma.marketplaceCheckout.findMany({ take: 100, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { publicReference: true, status: true, grandTotal: true, currency: true, createdAt: true, updatedAt: true } }),
    prisma.marketplaceOrder.findMany({ take: 100, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { publicReference: true, status: true, grandTotal: true, currency: true, createdAt: true } }),
    prisma.marketplaceInventoryReservation.findMany({ take: 100, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { publicReference: true, status: true, expiresAt: true, paymentUncertainAt: true } }),
    prisma.marketplaceSettlementSnapshot.findMany({ take: 100, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { publicReference: true, status: true, sellerBasis: true, commissionAmount: true, storeEarningAmount: true, deliveryFeeResidual: true } }),
    prisma.marketplaceCheckoutReconciliationCase.findMany({ take: 100, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { publicReference: true, reason: true, status: true, createdAt: true } }),
  ]);
  return {
    checkouts: checkouts.map((row) => ({ ...row, grandTotal: row.grandTotal.toFixed(2) })),
    orders: orders.map((row) => ({ ...row, grandTotal: row.grandTotal.toFixed(2) })),
    reservations,
    settlements: settlements.map((row) => ({ ...row, sellerBasis: row.sellerBasis.toFixed(2), commissionAmount: row.commissionAmount.toFixed(2), storeEarningAmount: row.storeEarningAmount.toFixed(2), deliveryFeeResidual: row.deliveryFeeResidual.toFixed(2) })),
    reconciliationCases,
  };
}
