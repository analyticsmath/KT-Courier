import { PaymentError } from "./errors";

const PUBLIC_REFERENCE = /^[a-zA-Z0-9_-]{12,80}$/;
const PAYSTACK_REFERENCE = /^[a-zA-Z0-9.=-]+$/;

/**
 * Paystack transaction references may contain only alphanumeric characters
 * plus "-", "." and "=". KT public payment references may contain "_", so
 * underscores are escaped as "=u" before composing the provider reference.
 * PUBLIC_REFERENCE excludes "=", making this encoding deterministic and
 * collision-safe for the accepted local reference alphabet.
 */
export function createMerchantReference(publicPaymentReference: string, attemptNumber: number): string {
  if (!PUBLIC_REFERENCE.test(publicPaymentReference) || !Number.isSafeInteger(attemptNumber) || attemptNumber < 1) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Cannot create a safe payment merchant reference.");
  }

  const providerSafePublicReference = publicPaymentReference.replaceAll("_", "=u");
  const merchantReference = `kt-payment-${providerSafePublicReference}-attempt-${attemptNumber}`;

  if (!PAYSTACK_REFERENCE.test(merchantReference)) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Cannot create a Paystack-safe payment merchant reference.");
  }

  return merchantReference;
}
