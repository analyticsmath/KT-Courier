import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";

export type PaidMarketplaceCheckout = Readonly<{ id: string; publicReference: string; cartId: string; status: string; currency: string; grandTotal: string; commercialFingerprint: string; customerUserId: string | null; storeGroups: readonly MarketplacePaidStoreGroup[] }>;
export type MarketplacePaidStoreGroup = Readonly<{ checkoutStoreGroupId?: string; storeId: string; storeReference: string; merchandiseSubtotal: string; modifierSubtotal: string; deliveryFee: string; groupTotal: string; sellerIdentityEvidence: unknown; taxEvidence: unknown; termsReference: string | null; refundPolicyReference: string | null; lines: readonly MarketplacePaidLine[]; settlement: Readonly<{ commissionPlanReference: string | null; commissionPlanVersion: string | null; sellerBasis: string; commissionAmount: string; storeEarningAmount: string; deliveryFeeResidual: string; sourceEvidenceFingerprint: string; sourceSettlementEvidenceId: string; sourceCheckoutId: string; sourceCheckoutReviewVersion: number; sourceCheckoutStoreGroupId: string; sourceCommercialFingerprint: string }> }>;
export type MarketplacePaidLine = Readonly<{ checkoutLineSnapshotId: string; productReference: string; variantReference: string; offerReference: string; title: string; variantTitle: string; quantity: number; baseUnitPrice: string; modifierUnitTotal: string; effectiveUnitPrice: string; lineTotal: string; taxTreatment: string; includedTaxAmount: string | null; modifiers: readonly { groupReference: string; groupName: string; optionReference: string; optionName: string; quantity: number; priceDelta: string; totalContribution: string; sourceVersion: string }[]; allocations: readonly { type: "SELLER_BASIS" | "COMMISSION" | "STORE_EARNING"; amount: string; allocationVersion: string; roundingSequence: number; finalCentRecipient: boolean }[] }>;
export type MarketplaceFinalizationRepository = Readonly<{
  transaction<T>(work: () => Promise<T>): Promise<T>;
  lockVerifiedSuccessfulPayment(paymentId: string): Promise<{ id: string; publicReference: string; status: string; amount: string; currency: string; marketplaceCheckoutId: string | null } | null>;
  lockCheckout(checkoutId: string): Promise<PaidMarketplaceCheckout | null>;
  lockReservation(checkoutId: string): Promise<{ id: string; status: string; commercialFingerprint: string } | null>;
  findOrderByCheckout(checkoutId: string): Promise<{ publicReference: string } | null>;
  consumeReservation(reservationId: string, paymentId: string, operationId: string): Promise<void>;
  createMarketplaceOrder(input: Readonly<{ checkout: PaidMarketplaceCheckout; paymentId: string; paymentReference: string; guestConfirmationHash: string | null }>): Promise<{ id: string; publicReference: string }>;
  createMarketplaceStoreOrder(input: Readonly<{ marketplaceOrderId: string; group: MarketplacePaidStoreGroup }>): Promise<{ id: string; publicReference: string }>;
  createOrderLineEvidence(input: Readonly<{ marketplaceStoreOrderId: string; line: MarketplacePaidLine }>): Promise<void>;
  createSettlementSnapshot(input: Readonly<{ marketplaceStoreOrderId: string; paymentId: string; group: MarketplacePaidStoreGroup }>): Promise<void>;
  scheduleSettlement?(input: Readonly<{ marketplaceStoreOrderId: string; group: MarketplacePaidStoreGroup; operationId: string }>): Promise<void>;
  completeCheckoutAndConvertCart(checkoutId: string, cartId: string): Promise<void>;
}>;

export async function finalizePaidMarketplaceCheckout(repository: MarketplaceFinalizationRepository, input: Readonly<{ paymentId: string; checkoutId: string; operationId: string; guestConfirmationHash?: string | null; testApproval?: { approved: true } }>): Promise<{ publicReference: string; replayed: boolean }> {
  assertMarketplaceCheckoutProductionReady("ORDER_FINALIZATION", input.testApproval);
  return repository.transaction(async () => {
    const payment = await repository.lockVerifiedSuccessfulPayment(input.paymentId);
    if (!payment || payment.status !== "SUCCEEDED" || payment.marketplaceCheckoutId !== input.checkoutId || payment.currency !== "ZAR") throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Verified marketplace payment evidence is required.");
    const replay = await repository.findOrderByCheckout(input.checkoutId); if (replay) return { publicReference: replay.publicReference, replayed: true };
    const checkout = await repository.lockCheckout(input.checkoutId);
    if (!checkout || !["PAYMENT_PENDING", "PAYMENT_CONFIRMED", "COMPLETING"].includes(checkout.status) || checkout.currency !== "ZAR" || payment.amount !== checkout.grandTotal || !checkout.commercialFingerprint) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Paid checkout evidence is invalid.");
    const reservation = await repository.lockReservation(checkout.id);
    if (!reservation || !["ACTIVE", "PAYMENT_PENDING_HOLD"].includes(reservation.status) || reservation.commercialFingerprint !== checkout.commercialFingerprint) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Checkout inventory reservation is invalid.");
    await repository.consumeReservation(reservation.id, payment.id, input.operationId);
    const order = await repository.createMarketplaceOrder({ checkout, paymentId: payment.id, paymentReference: payment.publicReference, guestConfirmationHash: input.guestConfirmationHash ?? null });
    for (const group of checkout.storeGroups) {
      const storeOrder = await repository.createMarketplaceStoreOrder({ marketplaceOrderId: order.id, group });
      for (const line of group.lines) await repository.createOrderLineEvidence({ marketplaceStoreOrderId: storeOrder.id, line });
      await repository.createSettlementSnapshot({ marketplaceStoreOrderId: storeOrder.id, paymentId: payment.id, group });
      if (repository.scheduleSettlement) await repository.scheduleSettlement({ marketplaceStoreOrderId: storeOrder.id, group, operationId: `${input.operationId}:settlement:${storeOrder.id}` });
    }
    await repository.completeCheckoutAndConvertCart(checkout.id, checkout.cartId);
    return { publicReference: order.publicReference, replayed: false };
  });
}
