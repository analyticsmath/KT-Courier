import { PaymentError } from "./errors";

const PUBLIC_REFERENCE = /^[a-zA-Z0-9_-]{12,80}$/;

export function createMerchantReference(publicPaymentReference: string, attemptNumber: number): string {
  if (!PUBLIC_REFERENCE.test(publicPaymentReference) || !Number.isSafeInteger(attemptNumber) || attemptNumber < 1) {
    throw new PaymentError("PAYMENT_METADATA_INVALID", "Cannot create a safe payment merchant reference.");
  }
  return `kt:payment:${publicPaymentReference}:attempt:${attemptNumber}`;
}

