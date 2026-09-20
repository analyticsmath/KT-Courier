import { PaymentError } from "./errors";

const PUBLIC_REFERENCE = /^[a-zA-Z0-9_-]{12,80}$/;

/**
 * Paystack transaction references may contain only alphanumeric characters
 * plus "-", "." and "=". Keep this canonical merchant reference compatible
 * with the provider so a valid local payment attempt cannot be rejected solely
 * because of reference punctuation.
 */
export function createMerchantReference(publicPaymentReference: string, attemptNumber: number): string {
  if (!PUBLIC_REFERENCE.test(publicPaymentReference) || !Number.isSafeInteger(attemptNumber) || attemptNumber < 1) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Cannot create a safe payment merchant reference.");
  }
  return `kt-payment-${publicPaymentReference}-attempt-${attemptNumber}`;
}
