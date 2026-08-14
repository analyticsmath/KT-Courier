import { PaymentError } from "@/lib/payments/errors";

export type PaymentSubjectIntegrityInput = Readonly<{
  subjectType: "COURIER_ORDER" | "MARKETPLACE_CHECKOUT" | "SUBSCRIPTION_INVOICE" | "MANAGED_MARKETING_REQUEST";
  userId: string | null;
  orderId: string | null;
  marketplaceCheckoutId: string | null;
  marketplaceOrderId?: string | null;
  subscriptionInvoiceId?: string | null;
  managedMarketingRequestId?: string | null;
  managedMarketingRequesterUserId?: string | null;
  subscriptionInvoicePayerUserId?: string | null;
  checkoutCustomerUserId?: string | null;
  checkoutGuestAccessTokenHash?: string | null;
  marketplaceOrderCheckoutId?: string | null;
}>;

/**
 * Shared by Phase 10 preparation, Phase 12 application, preflight and the
 * marketplace finalizer. It intentionally carries no persistence policy.
 */
export function assertPaymentSubjectIntegrity(input: PaymentSubjectIntegrityInput): void {
  if (input.subjectType === "COURIER_ORDER") {
    if (!input.orderId || !input.userId || input.marketplaceCheckoutId || input.marketplaceOrderId || input.subscriptionInvoiceId) {
      throw new PaymentError("PAYMENT_METADATA_INVALID", "Courier payments require one courier order and an authenticated payer.");
    }
    return;
  }

  if (input.subjectType === "SUBSCRIPTION_INVOICE") {
    if (!input.subscriptionInvoiceId || !input.userId || input.orderId || input.marketplaceCheckoutId || input.marketplaceOrderId || input.subscriptionInvoicePayerUserId !== input.userId) {
      throw new PaymentError("PAYMENT_METADATA_INVALID", "Subscription payments require exactly one subscription invoice and its authorised payer.");
    }
    return;
  }

  if (input.subjectType === "MANAGED_MARKETING_REQUEST") {
    if (!input.managedMarketingRequestId || !input.userId || input.orderId || input.marketplaceCheckoutId || input.marketplaceOrderId || input.subscriptionInvoiceId || input.managedMarketingRequesterUserId !== input.userId) {
      throw new PaymentError("PAYMENT_METADATA_INVALID", "Managed marketing payments require the requesting store actor and exactly one campaign request.");
    }
    return;
  }

  if (input.orderId || !input.marketplaceCheckoutId || input.subscriptionInvoiceId) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Marketplace payments require exactly one marketplace checkout and no courier order.");
  }
  const authenticatedCheckout = !!input.checkoutCustomerUserId;
  const guestCheckout = !authenticatedCheckout && !!input.checkoutGuestAccessTokenHash;
  if (!authenticatedCheckout && !guestCheckout) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Guest marketplace payments require secure checkout ownership evidence.");
  }
  if (authenticatedCheckout && input.userId !== input.checkoutCustomerUserId) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Marketplace payment payer does not match checkout ownership.");
  }
  if (guestCheckout && input.userId) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Guest marketplace payments cannot claim an authenticated payer.");
  }
  if (input.marketplaceOrderId && input.marketplaceOrderCheckoutId !== input.marketplaceCheckoutId) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Marketplace payment order belongs to a different checkout.");
  }
}

export function marketplacePaymentSubject(input: Readonly<{
  checkoutId: string;
  customerUserId: string | null;
  guestAccessTokenHash: string | null;
  marketplaceOrderId?: string | null;
  marketplaceOrderCheckoutId?: string | null;
}>): PaymentSubjectIntegrityInput {
  const subject = Object.freeze({
    subjectType: "MARKETPLACE_CHECKOUT" as const,
    userId: input.customerUserId,
    orderId: null,
    marketplaceCheckoutId: input.checkoutId,
    marketplaceOrderId: input.marketplaceOrderId ?? null,
    checkoutCustomerUserId: input.customerUserId,
    checkoutGuestAccessTokenHash: input.guestAccessTokenHash,
    marketplaceOrderCheckoutId: input.marketplaceOrderCheckoutId ?? null,
  });
  assertPaymentSubjectIntegrity(subject);
  return subject;
}
