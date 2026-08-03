import { PaymentError } from "./errors";

const RETRYABLE_CODES = new Set(["P2034", "40001", "40P01"]);

export function isRetryablePaymentConcurrencyError(error: unknown): boolean {
  if (error instanceof PaymentError) return error.retryable;
  const candidate = error as { code?: string; meta?: { code?: string }; message?: string };
  return RETRYABLE_CODES.has(candidate?.code ?? "")
    || RETRYABLE_CODES.has(candidate?.meta?.code ?? "")
    || /40001|40P01|could not serialize access/i.test(candidate?.message ?? "");
}

export async function withPaymentDatabaseRetry<T>(operation: (attempt: number) => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!isRetryablePaymentConcurrencyError(error) || attempt >= retries) throw error;
    }
  }
}

