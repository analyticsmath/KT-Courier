import { DispatchError } from "./errors";
import { isRetryableTransactionError, calculateBackoff } from "../db/transaction-runner";

export async function withDispatchRetry<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof DispatchError ||
        attempt >= retries ||
        !isRetryableTransactionError(error)
      ) {
        throw error;
      }
      const backoffMs = calculateBackoff(attempt);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}
