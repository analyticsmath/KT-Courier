import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import {
  isLocalCheckoutValidationAllowed,
  isLocalFullFlowAllowed,
} from "@/lib/testing/safe-postgres-validator";
import { isCheckoutExposureAllowed } from "@/lib/runtime/deployment-classification";

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
  if (isLocalFullFlowAllowed(source as NodeJS.ProcessEnv)) {
    return Object.freeze({ enabled: true, blockReason: null });
  }

  // A valid temporary sandbox can expose checkout without opening live money.
  // Invalid/expired overrides remain closed even if public checkout is enabled.
  const paystack = resolvePaystackConfiguration(source);
  const temporaryProductionSandbox = source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true";
  if (temporaryProductionSandbox && (!paystack.runtime || paystack.runtime.environment !== "sandbox")) {
    return Object.freeze({ enabled: false, blockReason: "PAYSTACK_SANDBOX_EXPIRED_OR_INVALID" });
  }
  if (
    source.CHECKOUT_PUBLIC_ENABLED !== "true" &&
    !temporaryProductionSandbox &&
    !isLocalCheckoutValidationAllowed(source as NodeJS.ProcessEnv)
  ) {
    return Object.freeze({
      enabled: false,
      blockReason: "CHECKOUT_PUBLIC_DISABLED",
    });
  }

  const isAllowedInPrinciple =
    temporaryProductionSandbox || isCheckoutExposureAllowed(
      source,
      MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED,
    ) || isLocalCheckoutValidationAllowed(source as NodeJS.ProcessEnv);

  if (!isAllowedInPrinciple) {
    return Object.freeze({
      enabled: false,
      blockReason: MARKETPLACE_CHECKOUT_PUBLIC_BLOCK_REASON,
    });
  }

  if (!paystack.runtime || !paystack.state.active) {
    return Object.freeze({
      enabled: false,
      blockReason: paystack.state.blockReason ?? "PAYSTACK_DISABLED",
    });
  }
  return Object.freeze({ enabled: true, blockReason: null });
}

export function assertMarketplaceCheckoutProductionReady(
  operation: MarketplaceCheckoutProductionLockedError["operation"],
  testApproval?: { approved: true },
  source: Record<string, string | undefined> = process.env,
): void {
  if (testApproval?.approved === true) return;
  if (isLocalFullFlowAllowed(source as NodeJS.ProcessEnv)) return;
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
