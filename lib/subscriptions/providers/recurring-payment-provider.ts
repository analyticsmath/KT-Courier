import type { ProviderCustomerAction } from "@/lib/payments/providers/payment-provider-adapter";

export type SubscriptionProviderStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CANCELLED" | "FAILED" | "UNKNOWN";

export type RecurringProviderAuthority = Readonly<{
  authorityReference: string;
  contractReference: string;
  providerSubscriptionReference: string;
  tokenFingerprint: string | null;
}>;

export type RecurringPaymentProvider = Readonly<{
  code: "PAYFAST";
  createAuthorization(input: Readonly<{ contractReference: string; paymentReference: string; amount: string; currency: "ZAR"; payerReference: string; payerEmail: string; returnUrl: string; cancelUrl: string; notificationUrl: string; operationId: string }>): Promise<Readonly<{ providerCustomerReference?: string; providerSubscriptionReference?: string; action: ProviderCustomerAction; safeEvidence: Record<string, string> }>>;
  createOrUpdateSubscription(input: Readonly<{ authorityReference: string; contractReference: string; amount: string; currency: "ZAR"; operationId: string }>): Promise<Readonly<{ status: SubscriptionProviderStatus; providerSubscriptionReference?: string; safeEvidence: Record<string, string> }>>;
  chargeBillingCycle(input: Readonly<{ authorityReference: string; invoiceReference: string; paymentReference: string; amount: string; currency: "ZAR"; operationId: string }>): Promise<Readonly<{ status: "PENDING" | "FAILED" | "UNKNOWN"; safeEvidence: Record<string, string> }>>;
  pause(input: Readonly<{ authorityReference: string; operationId: string }>): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>>;
  resume(input: Readonly<{ authorityReference: string; operationId: string }>): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>>;
  cancel(input: Readonly<{ authorityReference: string; operationId: string }>): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>>;
  fetchStatus(input: Readonly<{ authorityReference: string }>): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>>;
}>;

/**
 * The concrete protocol authority deliberately has names that describe the
 * recurring transport rather than allowing a one-off checkout adapter to be
 * substituted accidentally.  The public service interface above remains a
 * small stable seam for customer and renewal workflows.
 */
export type PayfastRecurringProtocol = Readonly<{
  createRecurringAuthorization(input: Readonly<{ invoiceReference: string; contractReference: string; amount: string; currency: "ZAR"; billingDate: string; returnUrl: string; cancelUrl: string; notificationUrl: string; operationId: string }>): Promise<Readonly<{ action: ProviderCustomerAction; safeEvidence: Record<string, string> }>>;
  fetchRecurringAuthority(input: RecurringProviderAuthority): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>>;
  cancelRecurringAuthority(input: RecurringProviderAuthority & Readonly<{ operationId: string }>): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>>;
  synchronizeRecurringAuthority(input: RecurringProviderAuthority): Promise<Readonly<{ status: SubscriptionProviderStatus; safeEvidence: Record<string, string> }>>;
  chargeTokenizedCycle(input: RecurringProviderAuthority & Readonly<{ invoiceReference: string; paymentReference: string; amount: string; currency: "ZAR"; operationId: string }>): Promise<Readonly<{ status: "PENDING" | "FAILED" | "UNKNOWN"; safeEvidence: Record<string, string> }>>;
}>;
