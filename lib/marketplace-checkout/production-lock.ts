import {
  isDisposableBrowserValidationAllowed,
  isLocalFullFlowAllowed,
} from "@/lib/testing/safe-postgres-validator";
import { evaluateCommerceActivation } from "@/lib/runtime/commerce-activation";
import { isActualProductionInstance } from "@/lib/promotions/production-lock";
import { resolveQaAcceptanceLaneConfig } from "@/lib/qa-acceptance/config";

export const MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED =
  true as const;
export const MARKETPLACE_CHECKOUT_PUBLIC_BLOCK_REASON =
  "CHECKOUT_VALIDATION_FAILED" as const;
export const MARKETPLACE_CHECKOUT_PRODUCTION_BLOCK_REASON =
  "CHECKOUT_VALIDATION_FAILED" as const;

export class MarketplaceCheckoutProductionLockedError extends Error {
  readonly code: string;

  constructor(
    readonly operation:
      | "DELIVERY_QUOTE"
      | "CHECKOUT_REVIEW"
      | "ACKNOWLEDGEMENT"
      | "RESERVATION"
      | "PAYMENT"
      | "ORDER_FINALIZATION"
      | "SETTLEMENT"
      | "CANCELLATION",
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
  const activation = evaluateCommerceActivation(source);
  return Object.freeze({
    enabled: activation.publicCheckoutExposed,
    blockReason: activation.publicCheckoutExposed
      ? null
      : (activation.primaryBlockReason ?? MARKETPLACE_CHECKOUT_PUBLIC_BLOCK_REASON),
  });
}

export function assertMarketplaceCheckoutProductionReady(
  operation: MarketplaceCheckoutProductionLockedError["operation"],
  testApproval?: { approved?: true; qaAcceptanceApproved?: true },
  source: Record<string, string | undefined> = process.env,
): void {
  if (testApproval?.approved === true) {
    if (isActualProductionInstance(source)) {
      throw new MarketplaceCheckoutProductionLockedError(
        operation,
        "PRODUCTION_TEST_APPROVAL_FORBIDDEN",
      );
    }
    return;
  }
  if (testApproval?.qaAcceptanceApproved === true) {
    if (resolveQaAcceptanceLaneConfig(source).eligible) {
      return;
    }
  }
  if (
    isLocalFullFlowAllowed(source as NodeJS.ProcessEnv) ||
    isDisposableBrowserValidationAllowed(source as NodeJS.ProcessEnv)
  ) return;
  const gate = evaluateMarketplaceCheckoutPublicGate(source);
  if (!gate.enabled) {
    throw new MarketplaceCheckoutProductionLockedError(
      operation,
      gate.blockReason ?? MARKETPLACE_CHECKOUT_PUBLIC_BLOCK_REASON,
    );
  }
}

export function marketplaceCheckoutProductionReady(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return evaluateMarketplaceCheckoutPublicGate(source).enabled;
}
