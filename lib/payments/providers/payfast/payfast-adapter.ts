import { PaymentError } from "../../errors";
import type {
  PaymentProviderAdapter,
  ProviderCallContext,
  ProviderCheckoutSessionInput,
  ProviderCheckoutSessionResult,
} from "../payment-provider-adapter";
import type { PayfastRuntimeConfiguration } from "./payfast-config";
import { buildPayfastCheckoutRequest } from "./payfast-checkout-request";

export const PAYFAST_CAPABILITIES = Object.freeze({
  supportsRedirectCheckout: false,
  supportsFormPostCheckout: true,
  supportsStatusLookup: false,
  supportsIdempotentSessionCreation: false,
  supportsCancellation: false,
  supportsAuthorizationCapture: false,
  supportsAuthoritativeWebhookConfirmation: false,
});

export class PayfastAdapter implements PaymentProviderAdapter {
  readonly code = "PAYFAST" as const;
  readonly capabilities = PAYFAST_CAPABILITIES;
  readonly customerActionHosts: readonly string[];
  readonly checkoutAudit: PaymentProviderAdapter["checkoutAudit"];

  constructor(private readonly configuration: PayfastRuntimeConfiguration) {
    this.customerActionHosts = Object.freeze([new URL(configuration.processingEndpoint).hostname]);
    this.checkoutAudit = Object.freeze({
      environment: configuration.environment === "sandbox" ? "SANDBOX" : "PRODUCTION",
      protocolVersion: configuration.requestFieldVersion,
      configurationFingerprint: configuration.configurationFingerprint,
      credentialVersion: configuration.credentialVersion,
    });
  }

  async createCheckoutSession(
    input: ProviderCheckoutSessionInput,
    context: ProviderCallContext,
  ): Promise<ProviderCheckoutSessionResult> {
    if (context.signal.aborted) {
      const error = new Error("Payfast form construction was aborted.");
      error.name = "AbortError";
      throw error;
    }
    if (this.configuration.mode === "production") {
      throw new PaymentError("PAYFAST_PRODUCTION_NOT_READY", "Payfast production checkout is unavailable until consolidated validation is approved.");
    }
    const fields = buildPayfastCheckoutRequest(input, this.configuration);
    const customerAction = Object.freeze({
      type: "FORM_POST" as const,
      url: this.configuration.processingEndpoint,
      fields,
      expiresAt: null,
    });
    return Object.freeze({
      status: "REQUIRES_ACTION" as const,
      customerAction,
      providerStatusCode: "CHECKOUT_FORM_READY",
      safeMetadata: Object.freeze({
        environment: this.configuration.environment,
        signatureVersion: this.configuration.signatureVersion,
        requestFieldVersion: this.configuration.requestFieldVersion,
        configurationFingerprint: this.configuration.configurationFingerprint,
      }),
      definitive: false,
    });
  }
}
