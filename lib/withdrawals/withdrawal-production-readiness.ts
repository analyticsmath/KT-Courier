import { classifyRuntimeEnvironment } from "@/lib/runtime/deployment-classification";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import { WithdrawalError } from "./errors";

/**
 * Risk-scoped earned payout eligibility replaces the legacy unconditional
 * source-compiled refusal for approved DRIVER and STORE earnings payouts.
 *
 * Non-negotiable business separation:
 * - Customer wallet bank withdrawals remain STRICTLY FORBIDDEN by client policy
 *   (`CUSTOMER_WALLET_BANK_WITHDRAWAL_ALLOWED = false`).
 * - Promoter withdrawals remain separately gated by PROMOTERS_PRODUCTION_VALIDATION_APPROVED.
 * - Production payouts still require explicit runtime authorization
 *   (`WITHDRAWAL_PAYOUT_ENABLED=true`), valid production runtime classification,
 *   non-sandbox Paystack live credentials (for automated transfers), active
 *   owner WithdrawalPolicy, verified PayoutDestination, sufficient released
 *   earned balance, and maker/checker dual control.
 */
export const WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED = true as const;
export const CUSTOMER_WALLET_BANK_WITHDRAWAL_ALLOWED = false as const;
export const WITHDRAWAL_PRODUCTION_BLOCK_REASON = "WITHDRAWAL_PAYOUT_DISABLED" as const;

export type WithdrawalOperationScope =
  | "REQUEST"
  | "MANUAL_PAYOUT"
  | "AUTOMATED_TRANSFER";

export type WithdrawalProductionReadiness = Readonly<{
  productionActive: boolean;
  payoutEnabled: boolean;
  customerBankWithdrawalAllowed: false;
  automatedTransferReady: boolean;
  blockReason: string | null;
}>;

export function assertCustomerWalletBankWithdrawalForbidden(ownerType: string): void {
  if (ownerType.trim().toUpperCase() === "CUSTOMER") {
    throw new WithdrawalError(
      "WITHDRAWAL_OWNER_INELIGIBLE",
      "Customer wallet bank withdrawals are not permitted. Customer wallet balances can be spent on parcel and store orders.",
    );
  }
}

export function withdrawalProductionReadiness(
  source: Record<string, string | undefined> = process.env,
  scope: WithdrawalOperationScope = "REQUEST",
): WithdrawalProductionReadiness {
  const classification = classifyRuntimeEnvironment(source);
  const payoutEnabled = source.WITHDRAWAL_PAYOUT_ENABLED === "true";

  if (!classification.isValid) {
    return Object.freeze({
      productionActive: false,
      payoutEnabled,
      customerBankWithdrawalAllowed: false,
      automatedTransferReady: false,
      blockReason: classification.conflictReason ?? "RUNTIME_CLASSIFICATION_INVALID",
    });
  }

  const isProduction = classification.runtime === "production";
  const temporarySandbox = source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true";

  // Live payouts are strictly forbidden during a temporary on-site sandbox window.
  if (isProduction && temporarySandbox) {
    return Object.freeze({
      productionActive: false,
      payoutEnabled,
      customerBankWithdrawalAllowed: false,
      automatedTransferReady: false,
      blockReason: "PAYOUTS_FORBIDDEN_IN_TEMPORARY_SANDBOX",
    });
  }

  const paystack = resolvePaystackConfiguration(source);
  const networkDisabled = source.KT_NETWORK_DISABLED === "true";
  const automatedTransferReady = !networkDisabled && (isProduction
    ? Boolean(payoutEnabled && paystack.runtime && paystack.runtime.environment === "production")
    : Boolean(paystack.runtime || classification.runtime === "test"));

  if (!isProduction) {
    return Object.freeze({
      productionActive: true,
      payoutEnabled,
      customerBankWithdrawalAllowed: false,
      automatedTransferReady,
      blockReason: null,
    });
  }

  if (!payoutEnabled) {
    return Object.freeze({
      productionActive: false,
      payoutEnabled: false,
      customerBankWithdrawalAllowed: false,
      automatedTransferReady: false,
      blockReason: WITHDRAWAL_PRODUCTION_BLOCK_REASON,
    });
  }

  if (scope === "AUTOMATED_TRANSFER" && !automatedTransferReady) {
    return Object.freeze({
      productionActive: false,
      payoutEnabled: true,
      customerBankWithdrawalAllowed: false,
      automatedTransferReady: false,
      blockReason: networkDisabled
        ? "NETWORK_DISABLED_IN_DISPOSABLE_RUNTIME"
        : (paystack.state.blockReason ?? "PAYSTACK_LIVE_TRANSFER_CREDENTIALS_REQUIRED"),
    });
  }

  return Object.freeze({
    productionActive: true,
    payoutEnabled: true,
    customerBankWithdrawalAllowed: false,
    automatedTransferReady,
    blockReason: null,
  });
}

export function assertWithdrawalProductionActivation(
  source: Record<string, string | undefined> = process.env,
  scope: WithdrawalOperationScope = "REQUEST",
): void {
  const readiness = withdrawalProductionReadiness(source, scope);
  if (!readiness.productionActive) {
    throw new WithdrawalError(
      "WITHDRAWAL_PRODUCTION_LOCKED",
      readiness.blockReason
        ? `Withdrawals are currently unavailable: ${readiness.blockReason}.`
        : "Withdrawals are currently unavailable in this runtime configuration.",
    );
  }
}
