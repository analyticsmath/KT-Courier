/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect } from "vitest";
import {
  isRetryableTransactionError,
  runTransaction,
  runSerializableTransaction,
} from "../../lib/db/transaction-runner";

describe("P1R-005: Transaction Retry Classification & P2002 Uniqueness Exclusion", () => {
  it("verifies classification predicate correctly identifies retryable concurrency errors and rejects P2002", () => {
    // Retryable: P2034 (Prisma transaction serialization failure)
    expect(isRetryableTransactionError({ code: "P2034" })).toBe(true);

    // Retryable: 40001 (PostgreSQL serialization_failure)
    expect(isRetryableTransactionError({ meta: { code: "40001" } })).toBe(true);
    expect(isRetryableTransactionError({ message: "error 40001: could not serialize access" })).toBe(true);
    expect(isRetryableTransactionError({ message: "could not serialize access due to concurrent update" })).toBe(true);

    // Retryable: 40P01 (PostgreSQL deadlock_detected)
    expect(isRetryableTransactionError({ meta: { code: "40P01" } })).toBe(true);
    expect(isRetryableTransactionError({ message: "error 40P01: deadlock detected" })).toBe(true);
    expect(isRetryableTransactionError({ message: "deadlock detected" })).toBe(true);

    // NON-Retryable: P2002 (Prisma unique constraint violation) - Must NEVER be generically retried
    expect(isRetryableTransactionError({ code: "P2002", meta: { target: ["email"] } })).toBe(false);
    expect(isRetryableTransactionError({ code: "P2002", meta: { target: ["publicReference"] } })).toBe(false);

    // Generic non-retryable errors
    expect(isRetryableTransactionError(new Error("ValidationError: invalid input"))).toBe(false);
    expect(isRetryableTransactionError({ code: "P2025" })).toBe(false); // record not found
    expect(isRetryableTransactionError(null)).toBe(false);
    expect(isRetryableTransactionError(undefined)).toBe(false);
  });

  it("proves P2034 serialization error is automatically retried and succeeds on second attempt", async () => {
    let attempts = 0;
    const mockClient = {
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        attempts += 1;
        if (attempts === 1) {
          const err = new Error("Serialization failure") as Error & { code: string };
          err.code = "P2034";
          throw err;
        }
        return fn({});
      },
    } as any;

    const result = await runSerializableTransaction(
      async () => "SERIALIZABLE_SUCCESS",
      { maxRetries: 3, enableJitter: false, initialBackoffMs: 2 },
      mockClient
    );

    expect(attempts).toBe(2);
    expect(result).toBe("SERIALIZABLE_SUCCESS");
  });

  it("proves 40001 serialization error is automatically retried and succeeds on second attempt", async () => {
    let attempts = 0;
    const mockClient = {
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        attempts += 1;
        if (attempts === 1) {
          const err = new Error("could not serialize access due to concurrent update") as Error & { meta: { code: string } };
          err.meta = { code: "40001" };
          throw err;
        }
        return fn({});
      },
    } as any;

    const result = await runSerializableTransaction(
      async () => "SQLSTATE_40001_SUCCESS",
      { maxRetries: 3, enableJitter: false, initialBackoffMs: 2 },
      mockClient
    );

    expect(attempts).toBe(2);
    expect(result).toBe("SQLSTATE_40001_SUCCESS");
  });

  it("proves 40P01 deadlock error is automatically retried and succeeds on third attempt", async () => {
    let attempts = 0;
    const mockClient = {
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        attempts += 1;
        if (attempts <= 2) {
          const err = new Error("deadlock detected") as Error & { meta: { code: string } };
          err.meta = { code: "40P01" };
          throw err;
        }
        return fn({});
      },
    } as any;

    const result = await runSerializableTransaction(
      async () => "SQLSTATE_40P01_SUCCESS",
      { maxRetries: 3, enableJitter: false, initialBackoffMs: 2 },
      mockClient
    );

    expect(attempts).toBe(3);
    expect(result).toBe("SQLSTATE_40P01_SUCCESS");
  });

  it("proves generic P2002 unique constraint violation does NOT retry and fails immediately on attempt 1", async () => {
    let attempts = 0;
    const mockClient = {
      $transaction: async () => {
        attempts += 1;
        const err = new Error("Unique constraint failed on the fields: (`publicReference`)") as Error & { code: string };
        err.code = "P2002";
        throw err;
      },
    } as any;

    await expect(
      runSerializableTransaction(
        async () => "SHOULD_NOT_SUCCEED",
        { maxRetries: 5, enableJitter: false, initialBackoffMs: 2 },
        mockClient
      )
    ).rejects.toThrow("Unique constraint failed");

    // Exactly 1 attempt made — zero blind generic retries
    expect(attempts).toBe(1);
  });

  it("proves domain-specific P2002 reconciliation handles uniqueness locally without generic transaction retry", async () => {
    const existingWinnerRecord = {
      id: "ord_winner_123",
      operationId: "op_charge_456",
      status: "COMPLETED",
    };

    let txExecutionCount = 0;

    // Domain service function demonstrating canonical local P2002 reconciliation
    async function executeIdempotentCreationWithReconciliation(operationId: string) {
      return runTransaction(async (tx) => {
        txExecutionCount += 1;
        try {
          // Attempt to create
          throw Object.assign(new Error("Unique constraint failed on operationId"), { code: "P2002" });
        } catch (error: any) {
          if (error.code === "P2002") {
            // Locally catch P2002, read canonical winner, return deterministic result
            return {
              reconciled: true,
              record: existingWinnerRecord,
            };
          }
          throw error;
        }
      }, { maxRetries: 3 });
    }

    const result = await executeIdempotentCreationWithReconciliation("op_charge_456");

    expect(result.reconciled).toBe(true);
    expect(result.record.id).toBe("ord_winner_123");
    // Only 1 transaction run, no redundant retries
    expect(txExecutionCount).toBe(1);
  });
});
