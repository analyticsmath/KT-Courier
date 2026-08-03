import { createHash } from "node:crypto";

export type SubscriptionProviderEventResolution = "INITIAL_PAYMENT" | "RENEWAL_PAYMENT" | "DUPLICATE" | "RECONCILIATION_REQUIRED";

/** Pure Phase 12 extension policy. The ITN application remains authoritative;
 * this policy rejects a recurring event unless every immutable subscription
 * identity resolves to the same prepared invoice/cycle/contract. */
export function resolveSubscriptionProviderEvent(input: Readonly<{
  merchantInvoiceReference: string;
  preparedInvoiceReference: string;
  providerPaymentReference: string;
  previousProviderPaymentReference: string | null;
  providerToken: string | null;
  expectedTokenFingerprint: string | null;
  payerUserId: string;
  invoicePayerUserId: string;
  amount: string;
  invoiceAmount: string;
  currency: string;
  invoiceCurrency: string;
  providerEnvironment: "SANDBOX" | "PRODUCTION";
  preparedEnvironment: "SANDBOX" | "PRODUCTION";
  cycleNumber: number;
  invoiceStatus: "ISSUED" | "PAID" | "VOID" | "REFUNDED";
}>): SubscriptionProviderEventResolution {
  const tokenFingerprint = input.providerToken ? createHash("sha256").update(input.providerToken, "utf8").digest("hex") : null;
  if (input.merchantInvoiceReference !== input.preparedInvoiceReference || input.payerUserId !== input.invoicePayerUserId || input.amount !== input.invoiceAmount || input.currency !== "ZAR" || input.invoiceCurrency !== "ZAR" || input.providerEnvironment !== input.preparedEnvironment || (input.expectedTokenFingerprint && tokenFingerprint !== input.expectedTokenFingerprint)) return "RECONCILIATION_REQUIRED";
  if (input.invoiceStatus === "PAID") return input.previousProviderPaymentReference === input.providerPaymentReference ? "DUPLICATE" : "RECONCILIATION_REQUIRED";
  return input.cycleNumber === 1 ? "INITIAL_PAYMENT" : "RENEWAL_PAYMENT";
}
