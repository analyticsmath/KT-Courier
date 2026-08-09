import type { PayfastRuntimeConfiguration } from "@/lib/payments/providers/payfast/payfast-config";
import type { ProviderCustomerAction } from "@/lib/payments/providers/payment-provider-adapter";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import {
  buildPayfastRecurringApiRequest,
  parseBoundedPayfastRecurringJson,
  PAYFAST_RECURRING_TIMEOUT_MS,
  toPayfastZarCents,
  type PayfastRecurringApiRequest,
  type PayfastRecurringConfiguration,
} from "@/lib/subscriptions/providers/payfast-recurring-api";
import type { PayfastRecurringProtocol, RecurringPaymentProvider, RecurringProviderAuthority, SubscriptionProviderStatus } from "@/lib/subscriptions/providers/recurring-payment-provider";

type PayfastRecurringTransport = (request: Readonly<{
  url: string;
  method: PayfastRecurringApiRequest["method"];
  headers: Readonly<Record<string, string>>;
  body?: string;
  signal: AbortSignal;
}>) => Promise<Readonly<{ status: number; redirected: boolean; body: unknown }>>;

const SAFE_REFERENCE = /^[A-Za-z0-9_.:-]{1,160}$/;
const SAFE_URL = /^https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?$/;

function configurationFrom(runtime: PayfastRuntimeConfiguration): PayfastRecurringConfiguration {
  return Object.freeze({ merchantId: runtime.merchantId, passphrase: runtime.passphrase, apiOrigin: "https://api.payfast.co.za", apiVersion: "v1" });
}

function safeReference(value: unknown): string | null {
  return typeof value === "string" && SAFE_REFERENCE.test(value) ? value : null;
}

function normalizeStatus(value: unknown): SubscriptionProviderStatus {
  if (typeof value !== "string") return "UNKNOWN";
  switch (value.trim().toUpperCase()) {
    case "ACTIVE": case "ENABLED": return "ACTIVE";
    case "PENDING": case "PROCESSING": case "REQUIRES_ACTION": return "PENDING";
    case "PAUSED": case "SUSPENDED": return "PAUSED";
    case "CANCELLED": case "CANCELED": case "TERMINATED": return "CANCELLED";
    case "FAILED": case "DECLINED": return "FAILED";
    default: return "UNKNOWN";
  }
}

function safeMetadata(response: Record<string, unknown>, httpStatus: number): Record<string, string> {
  const providerReference = safeReference(response.id ?? response.subscription_id ?? response.token_reference);
  const providerStatus = typeof response.status === "string" && response.status.length <= 80 && /^[A-Za-z0-9_. -]+$/.test(response.status) ? response.status : "UNKNOWN";
  return Object.freeze({ httpStatus: String(httpStatus), providerStatus, ...(providerReference ? { providerReference } : {}) });
}

async function liveTransport(request: Readonly<{ url: string; method: PayfastRecurringApiRequest["method"]; headers: Readonly<Record<string, string>>; body?: string; signal: AbortSignal }>) {
  const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body, redirect: "error", signal: request.signal });
  const body = await response.text();
  return Object.freeze({ status: response.status, redirected: response.redirected, body });
}

/**
 * Provider-managed recurring implementation.  It is transport-concrete and
 * REST-signed, but production remains gated by the Phase 22 source lock. No
 * method opens a database transaction; callers must persist/lock evidence
 * before invoking it and apply the result in a later transaction.
 */
export class PayfastRecurringPaymentAdapter implements RecurringPaymentProvider, PayfastRecurringProtocol {
  readonly code = "PAYFAST" as const;
  private readonly configuration: PayfastRecurringConfiguration;
  private readonly transport: PayfastRecurringTransport;
  private readonly now: () => Date;

  constructor(runtime: PayfastRuntimeConfiguration, injected?: Readonly<{ transport: PayfastRecurringTransport; now: () => Date }>) {
    this.configuration = configurationFrom(runtime);
    this.transport = injected?.transport ?? liveTransport;
    this.now = injected?.now ?? (() => new Date());
  }

  private async request(input: Omit<Parameters<typeof buildPayfastRecurringApiRequest>[0], "configuration" | "timestamp">) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAYFAST_RECURRING_TIMEOUT_MS);
    try {
      const request = buildPayfastRecurringApiRequest({ ...input, configuration: this.configuration, timestamp: this.now().toISOString() });
      const response = await this.transport({ url: request.url, method: request.method, headers: request.headers, ...(request.body ? { body: request.body } : {}), signal: controller.signal });
      return parseBoundedPayfastRecurringJson(response);
    } catch (error) {
      if (error instanceof SubscriptionError) throw error;
      // Provider execution may have reached PayFast despite a network failure.
      throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "PayFast recurring network outcome is unknown.", true);
    } finally {
      clearTimeout(timeout);
    }
  }

  async createRecurringAuthorization(input: Parameters<PayfastRecurringProtocol["createRecurringAuthorization"]>[0]) {
    const amountInCents = toPayfastZarCents(input.amount);
    const result = await this.request({
      method: "POST", path: "/subscriptions/authorizations", operationId: input.operationId,
      body: {
        merchant_reference: input.invoiceReference,
        contract_reference: input.contractReference,
        amount: amountInCents,
        currency: input.currency,
        billing_date: input.billingDate,
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        notify_url: input.notificationUrl,
        recurring: "1",
      },
    });
    const actionUrl = typeof result.body.redirect_url === "string" && SAFE_URL.test(result.body.redirect_url) ? result.body.redirect_url : null;
    const merchantReference = safeReference(result.body.merchant_reference);
    if (result.status < 200 || result.status >= 300 || !actionUrl || merchantReference !== input.invoiceReference) {
      throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "PayFast recurring authorization response did not bind the exact invoice.", true);
    }
    const action: ProviderCustomerAction = Object.freeze({ type: "REDIRECT_GET", url: actionUrl, expiresAt: null });
    return Object.freeze({ action, safeEvidence: Object.freeze({ ...safeMetadata(result.body, result.status), mode: "PROVIDER_MANAGED_SUBSCRIPTION", merchantReference: input.invoiceReference, amountInCents }) });
  }

  async fetchRecurringAuthority(input: RecurringProviderAuthority) {
    const reference = safeReference(input.providerSubscriptionReference);
    if (!reference) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "Provider subscription authority is invalid.");
    const result = await this.request({ method: "GET", path: `/subscriptions/${encodeURIComponent(reference)}`, operationId: `fetch:${reference}` });
    return Object.freeze({ status: normalizeStatus(result.body.status), safeEvidence: safeMetadata(result.body, result.status) });
  }

  async synchronizeRecurringAuthority(input: RecurringProviderAuthority) { return this.fetchRecurringAuthority(input); }

  async cancelRecurringAuthority(input: Parameters<PayfastRecurringProtocol["cancelRecurringAuthority"]>[0]) {
    const reference = safeReference(input.providerSubscriptionReference);
    if (!reference) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "Provider subscription authority is invalid.");
    const result = await this.request({ method: "DELETE", path: `/subscriptions/${encodeURIComponent(reference)}`, operationId: input.operationId });
    const status = normalizeStatus(result.body.status);
    return Object.freeze({ status: status === "UNKNOWN" && result.status >= 200 && result.status < 300 ? "CANCELLED" : status, safeEvidence: safeMetadata(result.body, result.status) });
  }

  async chargeTokenizedCycle(_input?: Parameters<PayfastRecurringProtocol["chargeTokenizedCycle"]>[0]): Promise<Readonly<{ status: "PENDING" | "UNKNOWN" | "FAILED"; safeEvidence: Record<string, string> }>> {
    void _input;
    // Platform-scheduled token charging remains source-locked. Provider-managed
    // cycles are charged by PayFast and resolved by authoritative ITN instead.
    throw new SubscriptionError("CONSOLIDATED_VALIDATION_NOT_APPROVED", "PLATFORM_SCHEDULED_TOKEN recurring charges are source-locked; provider-managed cycles await authoritative ITN.");
  }

  async createAuthorization(input: Parameters<RecurringPaymentProvider["createAuthorization"]>[0]) {
    return this.createRecurringAuthorization({ invoiceReference: input.paymentReference, contractReference: input.contractReference, amount: input.amount, currency: input.currency, billingDate: this.now().toISOString(), returnUrl: input.returnUrl, cancelUrl: input.cancelUrl, notificationUrl: input.notificationUrl, operationId: input.operationId });
  }

  async createOrUpdateSubscription(_input?: Parameters<RecurringPaymentProvider["createOrUpdateSubscription"]>[0]): Promise<Readonly<{ status: SubscriptionProviderStatus; providerSubscriptionReference?: string; safeEvidence: Record<string, string> }>> {
    void _input;
    throw new SubscriptionError("CONSOLIDATED_VALIDATION_NOT_APPROVED", "Provider-managed plan updates are source-locked until update semantics are validated.");
  }

  async chargeBillingCycle(input: Parameters<RecurringPaymentProvider["chargeBillingCycle"]>[0]) {
    // No token is accepted through this legacy seam. Provider-managed billing
    // only accepts the provider's ITN for a pre-created invoice.
    void input;
    return Object.freeze({ status: "PENDING" as const, safeEvidence: Object.freeze({ mode: "PROVIDER_MANAGED_SUBSCRIPTION", authority: "PROVIDER_ITN_REQUIRED" }) });
  }

  async pause(_input?: Parameters<RecurringPaymentProvider["pause"]>[0]): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>> { void _input; throw new SubscriptionError("CONSOLIDATED_VALIDATION_NOT_APPROVED", "Subscription pause is unsupported for launch."); }
  async resume(_input?: Parameters<RecurringPaymentProvider["resume"]>[0]): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>> { void _input; throw new SubscriptionError("CONSOLIDATED_VALIDATION_NOT_APPROVED", "Subscription resume is unsupported for launch."); }
  async cancel(_input?: Parameters<RecurringPaymentProvider["cancel"]>[0]): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>> {
    void _input;
    // The canonical cancellation service resolves exact provider ownership
    // before calling `cancelRecurringAuthority`; this untyped legacy seam must
    // not turn an internal reference into a provider reference.
    throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "Cancellation requires a resolved provider authority.");
  }
  async fetchStatus(_input?: Parameters<RecurringPaymentProvider["fetchStatus"]>[0]): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>> {
    void _input;
    throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "Status synchronization requires a resolved provider authority.");
  }
}
