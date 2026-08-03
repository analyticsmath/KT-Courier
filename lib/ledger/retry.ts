import { LEDGER_SERIALIZABLE_RETRIES } from "./config";
import { LedgerError } from "./errors";

const RETRYABLE_CODES = new Set(["P2034", "40001", "40P01"]);

export function isRetryableLedgerConcurrencyError(error: unknown): boolean {
  if (error instanceof LedgerError) return error.retryable;
  const prismaCode = (error as { code?: string })?.code ?? "";
  const dbCode = (error as { meta?: { code?: string } })?.meta?.code ?? "";
  const message = (error as { message?: string })?.message ?? "";
  return (
    RETRYABLE_CODES.has(prismaCode) ||
    RETRYABLE_CODES.has(dbCode) ||
    message.includes("40001") ||
    message.includes("40P01") ||
    message.includes("could not serialize access")
  );
}

export async function withLedgerRetry<T>(
  operation: (attempt: number) => Promise<T>,
  retries = LEDGER_SERIALIZABLE_RETRIES
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!isRetryableLedgerConcurrencyError(error) || attempt >= retries) throw error;
    }
  }
}

