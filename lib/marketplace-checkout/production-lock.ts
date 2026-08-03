export const MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED = false as const;
export const MARKETPLACE_CHECKOUT_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export class MarketplaceCheckoutProductionLockedError extends Error {
  readonly code = MARKETPLACE_CHECKOUT_PRODUCTION_BLOCK_REASON;

  constructor(readonly operation: "DELIVERY_QUOTE" | "CHECKOUT_REVIEW" | "ACKNOWLEDGEMENT" | "RESERVATION" | "PAYMENT" | "ORDER_FINALIZATION" | "SETTLEMENT" | "CANCELLATION") {
    super(`${operation} is inactive until consolidated validation is approved.`);
    this.name = "MarketplaceCheckoutProductionLockedError";
  }
}

/** There is intentionally no environment-variable bypass. */
export function assertMarketplaceCheckoutProductionReady(
  operation: MarketplaceCheckoutProductionLockedError["operation"],
  testApproval?: { approved: true },
): void {
  if (MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED || testApproval?.approved === true) return;
  throw new MarketplaceCheckoutProductionLockedError(operation);
}

export function marketplaceCheckoutProductionReady(): boolean {
  return MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED;
}
