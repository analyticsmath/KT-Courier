import { isRetryableTransactionError, calculateBackoff } from "./transaction-runner";

export interface SerializableRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  enableJitter?: boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export function isSerializableConcurrencyError(error: unknown): boolean {
  return isRetryableTransactionError(error);
}

/**
 * Executes an operation with bounded retries upon serialization failures,
 * write conflicts, or deadlock errors (e.g. PostgreSQL 40001, 40P01, Prisma P2034).
 */
export async function withSerializableRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: SerializableRetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  const initialDelayMs = options.initialDelayMs ?? 25;
  const maxDelayMs = options.maxDelayMs ?? 500;
  const enableJitter = options.enableJitter ?? true;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!isSerializableConcurrencyError(error) || attempt >= maxRetries) {
        throw error;
      }
      const delay = calculateBackoff(attempt, initialDelayMs, maxDelayMs, enableJitter);
      options.onRetry?.(error, attempt, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
