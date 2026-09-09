import { PaymentError } from "../../errors";
import type {
  PaymentProviderAdapter,
  PaymentProviderCapabilities,
  ProviderCallContext,
  ProviderCheckoutSessionInput,
  ProviderCheckoutSessionResult,
  ProviderPaymentStatusResult,
  ProviderStatusLookupInput,
} from "../payment-provider-adapter";
import type { PaystackRuntimeConfiguration } from "./paystack-config";
import {
  PaystackClient,
  zarToSubunitCents,
  validatePaystackAuthorizationUrl,
  type PaystackVerifyData,
} from "./paystack-client";

export const PAYSTACK_CAPABILITIES: PaymentProviderCapabilities = Object.freeze({
  supportsRedirectCheckout: true,
  supportsFormPostCheckout: false,
  supportsStatusLookup: true,
  supportsIdempotentSessionCreation: true,
  supportsCancellation: false,
  supportsAuthorizationCapture: false,
  supportsAuthoritativeWebhookConfirmation: true,
});

export const PAYSTACK_ALLOWED_CUSTOMER_ACTION_HOSTS = Object.freeze([
  "checkout.paystack.com",
  "standard.paystack.co",
]);

export class PaystackAdapter implements PaymentProviderAdapter {
  readonly code = "PAYSTACK" as const;
  readonly capabilities = PAYSTACK_CAPABILITIES;
  readonly customerActionHosts = PAYSTACK_ALLOWED_CUSTOMER_ACTION_HOSTS;
  readonly checkoutAudit: PaymentProviderAdapter["checkoutAudit"];
  private readonly client: PaystackClient;

  constructor(
    private readonly configuration: PaystackRuntimeConfiguration,
    clientOverride?: PaystackClient,
  ) {
    this.client = clientOverride ?? new PaystackClient({
      secretKey: configuration.secretKey,
      baseUrl: configuration.apiBaseUrl,
    });
    this.checkoutAudit = Object.freeze({
      environment: configuration.environment === "sandbox" ? "SANDBOX" : "PRODUCTION",
      protocolVersion: configuration.checkoutAuditVersion,
      configurationFingerprint: configuration.configurationFingerprint,
      credentialVersion: configuration.credentialVersion,
    });
  }

  async createCheckoutSession(
    input: ProviderCheckoutSessionInput,
    context: ProviderCallContext,
  ): Promise<ProviderCheckoutSessionResult> {
    if (context.signal.aborted) {
      const error = new Error("Paystack session creation was aborted.");
      error.name = "AbortError";
      throw error;
    }

    if (this.configuration.mode === "disabled") {
      throw new PaymentError("PAYMENT_PROVIDER_NOT_CONFIGURED", "Paystack payment provider is disabled.");
    }

    const amountCents = zarToSubunitCents(input.amount);
    if (input.currency !== "ZAR") {
      throw new PaymentError("PAYMENT_CURRENCY_INVALID", "Paystack payments must be in ZAR.");
    }

    // Attempt recovery: if the attempt already exists upstream due to a retry/timeout, verify first
    try {
      const existing = await this.client.verifyTransaction(input.merchantReference, context.signal);
      if (existing && existing.status === "success") {
        return Object.freeze({
          status: "SUCCEEDED" as const,
          providerReference: existing.reference,
          providerStatusCode: existing.status,
          definitive: true,
          safeMetadata: Object.freeze({
            channel: existing.channel,
            gatewayResponse: existing.gateway_response,
          }),
        });
      }
    } catch {
      // Transaction doesn't exist yet on Paystack; proceed to initialize
    }

    const initData = await this.client.initializeTransaction({
      email: input.customerEmail,
      amountCents,
      reference: input.merchantReference,
      callbackUrl: input.returnUrl,
      metadata: Object.freeze({
        paymentPublicReference: input.paymentPublicReference,
        orderReference: input.orderReference,
        customerReference: input.customerReference,
        providerOperationKey: input.providerOperationKey,
      }),
    }, context.signal);

    const safeUrl = validatePaystackAuthorizationUrl(initData.authorization_url);

    return Object.freeze({
      status: "REQUIRES_ACTION" as const,
      providerReference: initData.reference,
      customerAction: Object.freeze({
        type: "REDIRECT_GET" as const,
        url: safeUrl,
        expiresAt: null,
      }),
      providerStatusCode: "INITIALIZED",
      safeMetadata: Object.freeze({
        environment: this.configuration.environment,
        reference: initData.reference,
      }),
      definitive: false,
    });
  }

  async getPaymentStatus(
    input: ProviderStatusLookupInput,
    context: ProviderCallContext,
  ): Promise<ProviderPaymentStatusResult> {
    if (context.signal.aborted) {
      const error = new Error("Paystack status lookup was aborted.");
      error.name = "AbortError";
      throw error;
    }

    const reference = input.merchantReference;
    const verifyData: PaystackVerifyData = await this.client.verifyTransaction(reference, context.signal);

    return this.normalizeVerifyStatus(verifyData);
  }

  private normalizeVerifyStatus(data: PaystackVerifyData): ProviderPaymentStatusResult {
    const rawStatus = data.status?.toLowerCase();
    let status: ProviderPaymentStatusResult["status"];
    let definitive: boolean;

    switch (rawStatus) {
      case "success":
        status = "SUCCEEDED";
        definitive = true;
        break;
      case "failed":
        status = "FAILED";
        definitive = true;
        break;
      case "abandoned":
        status = "CANCELLED";
        definitive = true;
        break;
      case "pending":
      case "ongoing":
      case "processing":
        status = "PROCESSING";
        definitive = false;
        break;
      default:
        status = "UNKNOWN";
        definitive = false;
        break;
    }

    return Object.freeze({
      status,
      providerReference: data.reference,
      providerStatusCode: data.status,
      safeMetadata: Object.freeze({
        channel: data.channel,
        gatewayResponse: data.gateway_response,
        paidAt: data.paid_at,
        currency: data.currency,
        amountCents: data.amount,
      }),
      providerTimestamp: data.paid_at ? new Date(data.paid_at) : new Date(data.created_at),
      definitive,
    });
  }
}
