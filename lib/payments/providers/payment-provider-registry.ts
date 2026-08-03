import { PaymentError } from "../errors";
import type { PaymentProviderCode } from "../types";
import type { PaymentProviderAdapter, PaymentProviderCapabilities } from "./payment-provider-adapter";
import { PayfastAdapter, PAYFAST_CAPABILITIES } from "./payfast/payfast-adapter";
import { resolvePayfastConfiguration } from "./payfast/payfast-config";
import {
  injectedTestProviderState,
  type SafeProviderConfigurationState,
  unconfiguredProviderState,
} from "./provider-config";

export const KNOWN_PAYMENT_PROVIDER_CODES = Object.freeze(["PAYFAST"] as const);

const PAYFAST_FOUNDATION_CAPABILITIES: PaymentProviderCapabilities = PAYFAST_CAPABILITIES;

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
      if (!KNOWN_PAYMENT_PROVIDER_CODES.includes(adapter.code)) {
        throw new PaymentError("PAYMENT_PROVIDER_NOT_SUPPORTED", "Payment provider is not allowlisted.");
      }
      if (this.#adapters.has(adapter.code)) {
        throw new PaymentError("PAYMENT_PROVIDER_CONFIGURATION_INVALID", "Payment provider is registered more than once.");
      }
      this.#adapters.set(adapter.code, adapter);
      if (!this.#configuration.has(adapter.code)) this.#configuration.set(adapter.code, injectedTestProviderState(adapter.code));
    }
  }

  getAdapter(code: PaymentProviderCode): PaymentProviderAdapter {
    const adapter = this.#adapters.get(code);
    const state = this.#configuration.get(code);
    if (state?.blockReason === "CONSOLIDATED_VALIDATION_NOT_APPROVED") {
      throw new PaymentError("PAYFAST_PRODUCTION_NOT_READY", "Payfast production checkout is unavailable until consolidated validation is approved.");
    }
    if (state?.errorCategory === "CONFIGURATION") {
      throw new PaymentError("PAYFAST_CONFIGURATION_INVALID", "Payfast provider configuration is invalid.");
    }
    if (!adapter || !state?.configured || !state.active) {
      throw new PaymentError("PAYFAST_NOT_CONFIGURED", "Payfast provider is not configured.");
    }
    return adapter;
  }

  readiness(): readonly PaymentProviderReadinessDto[] {
    return KNOWN_PAYMENT_PROVIDER_CODES.map((code) => {
      const adapter = this.#adapters.get(code);
      const configuration = this.#configuration.get(code) ?? unconfiguredProviderState(code);
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
        capabilities: adapter?.capabilities ?? PAYFAST_FOUNDATION_CAPABILITIES,
      });
    });
  }
}

export function createProductionPaymentProviderRegistry(): PaymentProviderRegistry {
  const resolution = resolvePayfastConfiguration();
  const adapter = resolution.runtime && resolution.state.active
    ? new PayfastAdapter(resolution.runtime)
    : undefined;
  return new PaymentProviderRegistry({
    adapters: adapter ? [adapter] : [],
    configuration: [resolution.state],
  });
}
