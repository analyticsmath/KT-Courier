import type {
  PaymentProviderAdapter,
  ProviderCallContext,
  ProviderCheckoutSessionInput,
  ProviderCheckoutSessionResult,
} from "@/lib/payments/providers/payment-provider-adapter";

export type FakeProviderOutcome = "requires-action" | "processing" | "succeeded" | "failure" | "timeout" | "malformed" | "expired";

export class FakePaymentProvider implements PaymentProviderAdapter {
  readonly code = "PAYFAST" as const;
  readonly capabilities = Object.freeze({
    supportsRedirectCheckout: true,
    supportsFormPostCheckout: false,
    supportsStatusLookup: true,
    supportsIdempotentSessionCreation: true,
    supportsCancellation: false,
    supportsAuthorizationCapture: false,
    supportsAuthoritativeWebhookConfirmation: false,
  });
  readonly customerActionHosts = Object.freeze(["checkout.test.ktcouriers.local"]);
  readonly allowsHttpCustomerActionsForInjectedTests = false;
  readonly checkoutAudit = Object.freeze({ environment: "SANDBOX" as const, protocolVersion: "fake-v1", configurationFingerprint: "fake-v1:sandbox", credentialVersion: "fake-credentials-v1" });
  calls = 0;

  constructor(private readonly outcome: FakeProviderOutcome) {}

  async createCheckoutSession(input: ProviderCheckoutSessionInput, context: ProviderCallContext): Promise<ProviderCheckoutSessionResult> {
    this.calls += 1;
    if (context.signal.aborted || this.outcome === "timeout") {
      const error = new Error("Injected timeout");
      error.name = "AbortError";
      throw error;
    }
    if (this.outcome === "malformed") return { status: "REQUIRES_ACTION", definitive: false };
    if (this.outcome === "failure") return { status: "FAILED", providerStatusCode: "DECLINED", definitive: true };
    if (this.outcome === "expired") return { status: "EXPIRED", providerStatusCode: "SESSION_EXPIRED", definitive: true };
    if (this.outcome === "processing") return { status: "PROCESSING", providerReference: `fake:${input.merchantReference}`, providerStatusCode: "PENDING", definitive: false };
    if (this.outcome === "succeeded") return { status: "SUCCEEDED", providerReference: `fake:${input.merchantReference}`, providerStatusCode: "COMPLETE", definitive: true };
    return {
      status: "REQUIRES_ACTION",
      providerReference: `fake:${input.merchantReference}`,
      customerAction: Object.freeze({
        type: "REDIRECT_GET" as const,
        url: `https://checkout.test.ktcouriers.local/session/${encodeURIComponent(input.merchantReference)}`,
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
      providerStatusCode: "ACTION_REQUIRED",
      safeMetadata: Object.freeze({ fixture: "requires-action" }),
      definitive: true,
    };
  }
}
