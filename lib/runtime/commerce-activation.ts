/**
 * KT Couriers — Authoritative Commerce Activation Authority
 *
 * Single canonical runtime evaluation shared by:
 * - Parcel quote payment-method discovery
 * - Payment provider registration & Paystack checkout readiness
 * - Public parcel checkout & marketplace store checkout gates
 * - Promotions commercial release gate
 * - Admin production readiness & capability matrix
 *
 * Security invariants:
 * - `KT_COMMERCE_ENABLED` ONLY gates public creation/exposure of new commerce.
 * - Turning it off NEVER suppresses verified webhooks, Paystack Verify recovery,
 *   payment reconciliation, refunds for already-paid orders, customer notices,
 *   privacy processing, or 24-hour unpaid parcel expiry.
 * - Turning it on NEVER makes a payment SUCCEEDED, posts a ledger journal,
 *   signs a webhook, approves a store/driver, overrides high-risk cash rules,
 *   authorizes customer wallet bank withdrawals, or alters order snapshots.
 */

import {
  classifyRuntimeEnvironment,
  isCheckoutExposureAllowed,
  type KtRuntimeEnvironment,
} from "@/lib/runtime/deployment-classification";
import {
  resolveCommerceSwitch,
  type CommerceSwitchSource,
  type EnvironmentRecord,
} from "@/lib/runtime/commerce-switch";
import {
  evaluatePaystackCheckoutReadiness,
  isPaystackEftChannelApproved,
  resolvePaystackConfiguration,
  type PaystackMode,
} from "@/lib/payments/providers/paystack/paystack-config";
import type { SafeProviderConfigurationState } from "@/lib/payments/providers/provider-config";
import {
  isDisposableBrowserValidationAllowed,
  isLocalCheckoutValidationAllowed,
  isLocalFullFlowAllowed,
} from "@/lib/testing/safe-postgres-validator";

export { resolveCommerceSwitch, type CommerceSwitchResolution, type CommerceSwitchSource } from "./commerce-switch";

export type CommerceActivationPolicyContext = Readonly<{
  /** Whether parcel card policy + route/coverage checks passed for the requested quote. Defaults true for platform-level evaluation. */
  parcelPolicyEligible?: boolean;
  /** Whether store checkout policy + certified live store + cart checks passed. Defaults true for platform-level evaluation. */
  storePolicyEligible?: boolean;
  /** Whether approved scoped COD policy + deposit + non-high-risk + driver ceiling checks passed. Defaults false unless explicitly proven. */
  codPolicyEligible?: boolean;
  /** Optional pre-resolved Paystack provider state for read-only admin projections. */
  paystackStateOverride?: SafeProviderConfigurationState;
}>;

export type CommerceActivation = Readonly<{
  globalRequested: boolean;
  switchSource: CommerceSwitchSource;
  hasConflictingLegacySwitch: boolean;
  runtime: KtRuntimeEnvironment;
  runtimeValid: boolean;
  publicCheckoutExposed: boolean;
  parcelCardAllowed: boolean;
  storeCardAllowed: boolean;
  eftChannelAllowed: boolean;
  codOffered: boolean;
  paystackMode: PaystackMode;
  paystackEnvironment: SafeProviderConfigurationState["environment"];
  temporarySandboxActive: boolean;
  localValidationBypassActive: boolean;
  primaryBlockReason: string | null;
  reasonCodes: readonly string[];
  warnings: readonly string[];
}>;

/**
 * Evaluates the single canonical commerce activation decision for the given
 * runtime environment and optional per-flow business policy context.
 */
export function evaluateCommerceActivation(
  source: EnvironmentRecord = process.env,
  context: CommerceActivationPolicyContext = {},
): CommerceActivation {
  const switchState = resolveCommerceSwitch(source);
  const classification = classifyRuntimeEnvironment(source);
  const paystack = resolvePaystackConfiguration(source);
  const paystackState = context.paystackStateOverride ?? paystack.state;
  const eftApproved = isPaystackEftChannelApproved(source);

  const localFullFlow = isLocalFullFlowAllowed(source as NodeJS.ProcessEnv);
  const disposableBrowser = isDisposableBrowserValidationAllowed(source as NodeJS.ProcessEnv);
  const localCheckoutValidation = isLocalCheckoutValidationAllowed(source as NodeJS.ProcessEnv);
  const localValidationBypassActive = localFullFlow || disposableBrowser;

  const temporarySandboxRequested = source.PAYSTACK_TEMPORARY_SANDBOX_ENABLED === "true";
  const temporarySandboxActive =
    temporarySandboxRequested &&
    Boolean(paystack.runtime && paystack.runtime.environment === "sandbox") &&
    paystackState.active;

  const rawMode = (source.PAYSTACK_MODE?.trim().toLowerCase() || "disabled") as string;
  const paystackMode: PaystackMode =
    rawMode === "live" || rawMode === "test" || rawMode === "disabled"
      ? rawMode
      : "disabled";

  const reasonCodes: string[] = [];
  const warnings: string[] = [...switchState.warnings];

  let publicCheckoutExposed = false;
  let primaryBlockReason: string | null = null;

  if (localValidationBypassActive) {
    publicCheckoutExposed = true;
    warnings.push("LOCAL_VALIDATION_OVERRIDE_ACTIVE");
  } else if (!classification.isValid) {
    primaryBlockReason = classification.conflictReason ?? "RUNTIME_CLASSIFICATION_INVALID";
    reasonCodes.push(primaryBlockReason);
  } else if (temporarySandboxRequested && !temporarySandboxActive) {
    primaryBlockReason = "PAYSTACK_SANDBOX_EXPIRED_OR_INVALID";
    reasonCodes.push(primaryBlockReason);
  } else if (!switchState.globalRequested && !temporarySandboxActive && !localCheckoutValidation) {
    primaryBlockReason = "CHECKOUT_PUBLIC_DISABLED";
    reasonCodes.push("COMMERCE_DISABLED_BY_GLOBAL_SWITCH", "CHECKOUT_PUBLIC_DISABLED");
  } else {
    const exposureAllowedInPrinciple =
      temporarySandboxActive ||
      isCheckoutExposureAllowed(source, true) ||
      localCheckoutValidation;

    if (!exposureAllowedInPrinciple) {
      primaryBlockReason = "CHECKOUT_VALIDATION_FAILED";
      reasonCodes.push("CHECKOUT_VALIDATION_FAILED");
    } else {
      const readiness = evaluatePaystackCheckoutReadiness(paystackState, {
        adapterPresent: context.paystackStateOverride ? paystackState.configured : Boolean(paystack.runtime),
        requireAdapterPresent: !context.paystackStateOverride,
        requiredChannel: "card",
      });

      if (!readiness.ready) {
        primaryBlockReason = paystackState.blockReason ?? readiness.reasonCode ?? "PAYSTACK_DISABLED";
        reasonCodes.push(readiness.reasonCode);
        if (paystackState.blockReason && !reasonCodes.includes(paystackState.blockReason)) {
          reasonCodes.push(paystackState.blockReason);
        }
      } else {
        publicCheckoutExposed = true;
      }
    }
  }

  const parcelPolicyEligible = context.parcelPolicyEligible ?? true;
  const storePolicyEligible = context.storePolicyEligible ?? true;
  const codPolicyEligible = context.codPolicyEligible ?? false;

  const parcelCardAllowed = publicCheckoutExposed && parcelPolicyEligible;
  const storeCardAllowed = publicCheckoutExposed && storePolicyEligible;
  const eftChannelAllowed = publicCheckoutExposed && eftApproved;
  const codOffered = publicCheckoutExposed && codPolicyEligible;

  if (publicCheckoutExposed && !parcelPolicyEligible) {
    reasonCodes.push("PARCEL_CARD_POLICY_INELIGIBLE");
  }
  if (publicCheckoutExposed && !storePolicyEligible) {
    reasonCodes.push("STORE_CARD_POLICY_INELIGIBLE");
  }
  if (publicCheckoutExposed && context.codPolicyEligible === false) {
    reasonCodes.push("COD_POLICY_INELIGIBLE");
  }

  return Object.freeze({
    globalRequested: switchState.globalRequested,
    switchSource: switchState.source,
    hasConflictingLegacySwitch: switchState.hasConflictingLegacySwitch,
    runtime: classification.runtime,
    runtimeValid: classification.isValid,
    publicCheckoutExposed,
    parcelCardAllowed,
    storeCardAllowed,
    eftChannelAllowed,
    codOffered,
    paystackMode,
    paystackEnvironment: paystackState.environment,
    temporarySandboxActive,
    localValidationBypassActive,
    primaryBlockReason,
    reasonCodes: Object.freeze([...new Set(reasonCodes)]),
    warnings: Object.freeze([...new Set(warnings)]),
  });
}
