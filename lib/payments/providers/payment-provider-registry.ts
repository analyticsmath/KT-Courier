import { PaymentError } from "../errors";
import type { PaymentProviderCode } from "../types";
import type { PaymentProviderAdapter, PaymentProviderCapabilities } from "./payment-provider-adapter";
import { PaystackAdapter, PAYSTACK_CAPABILITIES } from "./paystack/paystack-adapter";
import {
  evaluatePaystackCheckoutReadiness,
  isPaystackEftChannelApproved,
  resolvePaystackConfiguration,
  type PaystackCheckoutReadinessResult,
} from "./paystack/paystack-config";
import {
  injectedTestProviderState,
  type SafeProviderConfigurationState,
  unconfiguredProviderState,
} from "./provider-config";

export const KNOWN_PAYMENT_PROVIDER_CODES = Object.freeze(["PAYSTACK"] as const);

export type PaymentProviderReadinessDto = Readonly<{
  code: PaymentProviderCode;
  configured: boolean;
  active: boolean;
  environment: SafeProviderConfigurationState["environment"];
  errorCategory: SafeProviderConfigurationState["errorCategory"];
  blockReason: SafeProviderConfigurationState["blockReason"];
  credentialVersionConfigured: boolean;
  sourceAddressTrustConfigured: boolean;
  itnVerificationImplemented: boolean;
  productionValidationApproved: boolean;
  checkoutReadiness: PaystackCheckoutReadinessResult;
  eftReadiness: PaystackCheckoutReadinessResult;
  capabilities: PaymentProviderCapabilities;
}>;

export class PaymentProviderRegistry {
  readonly #adapters = new Map<PaymentProviderCode, PaymentProviderAdapter>();
  readonly #configuration = new Map<PaymentProviderCode, SafeProviderConfigurationState>();

  constructor(options?: {
    adapters?: readonly PaymentProviderAdapter[];
    configuration?: readonly SafeProviderConfigurationState[];
  }) {
    for (const state of options?.configuration ?? []) this.#configuration.set(state.code, state);
    for (const adapter of options?.adapters ?? []) {
      if (!KNOWN_PAYMENT_PROVIDER_CODES.includes(adapter.code as "PAYSTACK")) {
        throw new PaymentError("PAYMENT_PROVIDER_NOT_SUPPORTED", `Payment provider ${adapter.code} is not supported.`);
      }
      if (this.#adapters.has(adapter.code)) {
        throw new PaymentError("PAYMENT_PROVIDER_CONFIGURATION_INVALID", "Payment provider is registered more than once.");
      }
      this.#adapters.set(adapter.code, adapter);
      if (!this.#configuration.has(adapter.code)) this.#configuration.set(adapter.code, injectedTestProviderState(adapter.code));
    }
  }

  getAdapter(code: PaymentProviderCode): PaymentProviderAdapter {
    if ((code as string) === "PAYFAST") {
      throw new PaymentError("PAYMENT_PROVIDER_NOT_SUPPORTED", "Payfast is no longer supported for new transactions.");
    }
    const adapter = this.#adapters.get(code);
    const state = this.#configuration.get(code);
    const checkoutReadiness = evaluatePaystackCheckoutReadiness(state, {
      adapterPresent: Boolean(adapter),
      requireAdapterPresent: true,
    });
    if (checkoutReadiness.reasonCode === "LIVE_CHECKOUT_NOT_AUTHORIZED") {
      throw new PaymentError("PAYMENT_PROVIDER_PRODUCTION_NOT_READY", `${code} production checkout is unavailable until validation is approved.`);
    }
    if (
      checkoutReadiness.reasonCode === "PROVIDER_CONFIG_INVALID" ||
      checkoutReadiness.reasonCode === "TEMP_SANDBOX_EXPIRED"
    ) {
      throw new PaymentError("PAYMENT_PROVIDER_CONFIGURATION_INVALID", `${code} provider configuration is invalid.`);
    }
    if (!adapter || !checkoutReadiness.ready) {
      throw new PaymentError("PAYMENT_PROVIDER_NOT_CONFIGURED", `${code} provider is not configured.`);
    }
    return adapter;
  }

  readiness(): readonly PaymentProviderReadinessDto[] {
    return KNOWN_PAYMENT_PROVIDER_CODES.map((code) => {
      const adapter = this.#adapters.get(code);
      const configuration = this.#configuration.get(code) ?? unconfiguredProviderState(code);
      const checkoutReadiness = evaluatePaystackCheckoutReadiness(configuration, {
        adapterPresent: Boolean(adapter),
      });
      const eftReadiness = evaluatePaystackCheckoutReadiness(configuration, {
        adapterPresent: Boolean(adapter),
        requiredChannel: "eft",
        eftChannelApproved: isPaystackEftChannelApproved(),
      });
      return Object.freeze({
        code,
        configured: configuration.configured,
        active: configuration.active,
        environment: configuration.environment,
        errorCategory: configuration.errorCategory,
        blockReason: configuration.blockReason,
        credentialVersionConfigured: configuration.credentialVersionConfigured,
        sourceAddressTrustConfigured: configuration.sourceAddressTrustConfigured,
        itnVerificationImplemented: configuration.itnVerificationImplemented,
        productionValidationApproved: configuration.productionValidationApproved,
        checkoutReadiness,
        eftReadiness,
        capabilities: adapter?.capabilities ?? PAYSTACK_CAPABILITIES,
      });
    });
  }
}

export function createProductionPaymentProviderRegistry(): PaymentProviderRegistry {
  const paystackResolution = resolvePaystackConfiguration();

  const adapters: PaymentProviderAdapter[] = [];
  if (paystackResolution.runtime && paystackResolution.state.active) {
    adapters.push(new PaystackAdapter(paystackResolution.runtime));
  }

  return new PaymentProviderRegistry({
    adapters,
    configuration: [paystackResolution.state],
  });
}
