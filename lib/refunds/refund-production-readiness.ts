import { classifyRuntimeEnvironment } from "@/lib/runtime/deployment-classification";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { RefundError } from "./errors";

export type RefundOperationScope =
  | "REQUEST"
  | "WALLET_COMPLETION"
  | "EXTERNAL_PROVIDER"
  | "RECONCILIATION";

export type RefundProductionReadinessState = Readonly<{
  known: true;
  configured: boolean;
  networkActive: boolean;
  walletRefundsActive: boolean;
  externalRefundsActive: boolean;
  productionValidationApproved: boolean;
  blockReason: string | null;
}>;

/**
 * Risk-scoped refund eligibility replaces the legacy unconditional source-compiled
 * refusal. Individual refund requests, wallet credits, and external provider
 * executions remain strictly governed by verified paid ledger evidence,
 * remaining refundable balance caps, dual-control approval, and provider
 * runtime credential validity.
 *
 * Turning KT_COMMERCE_ENABLED off does NOT block refunds for already-paid orders.
 */
export const REFUND_PRODUCTION_VALIDATION_APPROVED = true as const;

export function evaluateRefundProductionReadiness(
  source: Readonly<Record<string, string | undefined>> = process.env,
  scope: RefundOperationScope = "REQUEST",
): RefundProductionReadinessState {
  const classification = classifyRuntimeEnvironment(source);
  if (!classification.isValid) {
    return Object.freeze({
      known: true,
      configured: false,
      networkActive: false,
      walletRefundsActive: false,
      externalRefundsActive: false,
      productionValidationApproved: false,
      blockReason: classification.conflictReason ?? "RUNTIME_CLASSIFICATION_INVALID",
    });
  }

  const paystack = resolvePaystackConfiguration(source);
  const networkDisabled = source.KT_NETWORK_DISABLED === "true";
  // Note: paystack.runtime remains populated when PAYSTACK_MODE + valid key are
  // configured even if KT_COMMERCE_ENABLED=false, so already-paid orders can
  // still be refunded or reconciled without stranding customer liabilities.
  // However, automated external provider execution/reconciliation must never
  // attempt outbound network calls when KT_NETWORK_DISABLED=true unless an
  // isolated in-memory provider registry dependency is explicitly supplied.
  const externalRefundsActive = Boolean(
    !networkDisabled &&
      paystack.runtime &&
      paystack.state.configured &&
      (classification.runtime !== "production" ||
        paystack.runtime.environment === "production" ||
        source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true"),
  );
  const walletRefundsActive = true;

  let scopeAllowed = walletRefundsActive;
  let blockReason: string | null = null;
  if ((scope === "EXTERNAL_PROVIDER" || scope === "RECONCILIATION") && !externalRefundsActive) {
    scopeAllowed = false;
    blockReason = networkDisabled
      ? "NETWORK_DISABLED_IN_DISPOSABLE_RUNTIME"
      : (paystack.state.blockReason ?? "REFUND_PROVIDER_NOT_CONFIGURED");
  }

  return Object.freeze({
    known: true,
    configured: externalRefundsActive || walletRefundsActive,
    networkActive: externalRefundsActive,
    walletRefundsActive,
    externalRefundsActive,
    productionValidationApproved: scopeAllowed,
    blockReason,
  });
}

export const REFUND_PRODUCTION_READINESS: RefundProductionReadinessState = Object.freeze({
  known: true,
  configured: true,
  networkActive: false,
  walletRefundsActive: true,
  externalRefundsActive: false,
  productionValidationApproved: REFUND_PRODUCTION_VALIDATION_APPROVED,
  blockReason: null,
});

export function assertRefundProductionActivation(
  scope: RefundOperationScope = "REQUEST",
  source: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const readiness = evaluateRefundProductionReadiness(source, scope);
  if (!readiness.productionValidationApproved) {
    throw new RefundError(
      "REFUND_PRODUCTION_NOT_READY",
      readiness.blockReason
        ? `Refund operation (${scope}) is unavailable: ${readiness.blockReason}.`
        : "Refund operation is unavailable in the current runtime configuration.",
    );
  }
}
