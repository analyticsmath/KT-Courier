import type { PaymentCurrency, PaymentProviderCode } from "../types";
import type { SafeProviderJson } from "../provider-snapshot-policy";

export type PaymentProviderCapabilities = Readonly<{
  supportsRedirectCheckout: boolean;
  supportsFormPostCheckout: boolean;
  supportsStatusLookup: boolean;
  supportsIdempotentSessionCreation: boolean;
  supportsCancellation: boolean;
  supportsAuthorizationCapture: boolean;
  supportsAuthoritativeWebhookConfirmation: boolean;
}>;

export type ProviderCallContext = Readonly<{
  signal: AbortSignal;
  correlationId: string;
  timeoutMs: number;
}>;

export type ProviderCheckoutSessionInput = Readonly<{
  merchantReference: string;
  paymentPublicReference: string;
  amount: string;
  currency: PaymentCurrency;
  customerReference: string;
  customerEmail: string;
  customerName?: string;
  orderReference: string;
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
  description: string;
  providerOperationKey: string;
}>;

export type ProviderCustomerAction =
  | Readonly<{
      type: "REDIRECT_GET";
      url: string;
      expiresAt: string | null;
    }>
  | Readonly<{
      type: "FORM_POST";
      url: string;
      fields: Readonly<Record<string, string>>;
      expiresAt: string | null;
    }>;

export type ProviderCheckoutSessionStatus =
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "UNKNOWN";

export type ProviderCheckoutSessionResult = Readonly<{
  status: ProviderCheckoutSessionStatus;
  providerReference?: string;
  customerAction?: ProviderCustomerAction;
  providerStatusCode?: string;
  safeMetadata?: Readonly<Record<string, SafeProviderJson>>;
  providerTimestamp?: Date;
  definitive: boolean;
}>;

export type ProviderStatusLookupInput = Readonly<{
  merchantReference: string;
  providerReference?: string;
}>;

export type ProviderPaymentStatusResult = ProviderCheckoutSessionResult;

export interface PaymentProviderAdapter {
  readonly code: PaymentProviderCode;
  readonly capabilities: PaymentProviderCapabilities;
  readonly customerActionHosts: readonly string[];
  readonly allowsHttpCustomerActionsForInjectedTests?: boolean;
  readonly checkoutAudit: Readonly<{
    environment: "SANDBOX" | "PRODUCTION";
    protocolVersion: string;
    configurationFingerprint: string;
    credentialVersion: string;
  }>;

  createCheckoutSession(
    input: ProviderCheckoutSessionInput,
    context: ProviderCallContext,
  ): Promise<ProviderCheckoutSessionResult>;

  getPaymentStatus?(
    input: ProviderStatusLookupInput,
    context: ProviderCallContext,
  ): Promise<ProviderPaymentStatusResult>;
}
