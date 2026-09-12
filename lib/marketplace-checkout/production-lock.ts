import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { isLocalCheckoutValidationAllowed } from "@/lib/testing/safe-postgres-validator";

export const MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED = false as const;
export const MARKETPLACE_CHECKOUT_PUBLIC_BLOCK_REASON = "CHECKOUT_PUBLIC_DISABLED" as const;
export const MARKETPLACE_CHECKOUT_PRODUCTION_BLOCK_REASON = "CHECKOUT_PUBLIC_DISABLED" as const;

export class MarketplaceCheckoutProductionLockedError extends Error {
  readonly code: string;

  constructor(
    readonly operation: "DELIVERY_QUOTE" | "CHECKOUT_REVIEW" | "ACKNOWLEDGEMENT" | "RESERVATION" | "PAYMENT" | "ORDER_FINALIZATION" | "SETTLEMENT" | "CANCELLATION",
    code: string = MARKETPLACE_CHECKOUT_PUBLIC_BLOCK_REASON,
  ) {
    super(`${operation} is inactive: ${code}.`);
    this.code = code;
    this.name = "MarketplaceCheckoutProductionLockedError";
  }
}

export function evaluateMarketplaceCheckoutPublicGate(
  source: Record<string, string | undefined> = process.env,
): Readonly<{ enabled: boolean; blockReason: string | null }> {
  const isPublicEnabled = source.CHECKOUT_PUBLIC_ENABLED === "true";
  const isLocalAllowed = isLocalCheckoutValidationAllowed(source as NodeJS.ProcessEnv);
  if (!isPublicEnabled && !isLocalAllowed) {
    return Object.freeze({ enabled: false, blockReason: "CHECKOUT_PUBLIC_DISABLED" });
  }
  const paystack = resolvePaystackConfiguration(source);
  if (!paystack.runtime || !paystack.state.active) {
    return Object.freeze({ enabled: false, blockReason: paystack.state.blockReason ?? "PAYSTACK_DISABLED" });
  }
  return Object.freeze({ enabled: true, blockReason: null });
}

export function assertMarketplaceCheckoutProductionReady(
  operation: MarketplaceCheckoutProductionLockedError["operation"],
  testApproval?: { approved: true },
  source: Record<string, string | undefined> = process.env,
): void {
  if (testApproval?.approved === true) return;
  const gate = evaluateMarketplaceCheckoutPublicGate(source);
  if (!gate.enabled) {
    throw new MarketplaceCheckoutProductionLockedError(operation, gate.blockReason ?? MARKETPLACE_CHECKOUT_PUBLIC_BLOCK_REASON);
  }
}

export function marketplaceCheckoutProductionReady(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return evaluateMarketplaceCheckoutPublicGate(source).enabled;
}
