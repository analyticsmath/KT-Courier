import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { runTransaction, runSerializableTransaction, isRetryableTransactionError } from "@/lib/db/transaction-runner";
import { registerFaultInjectionHook, clearAllFaultInjectionHooks } from "@/lib/db/fault-injection";
import { prisma } from "@/lib/db/prisma";
import { createGate4User, requireGate4Fixture } from "./fixtures";

describe("Gate 4 — Transaction Retry and Fault Injection Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("verifies isRetryableTransactionError handles P2034, 40001, 40P01", () => {
    expect(isRetryableTransactionError({ code: "P2034" })).toBe(true);
    expect(isRetryableTransactionError({ meta: { code: "40001" } })).toBe(true);
    expect(isRetryableTransactionError({ message: "could not serialize access due to concurrent update" })).toBe(true);
    expect(isRetryableTransactionError({ message: "deadlock detected" })).toBe(true);
    expect(isRetryableTransactionError(new Error("Generic business validation error"))).toBe(false);
  });

  it("G4-RET-01 [Transaction Retry]: Automatically retries transient P2034 error and succeeds on second attempt", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    let attemptsCount = 0;

    const result = await runSerializableTransaction(
      async (tx) => {
        attemptsCount += 1;
        if (attemptsCount === 1) {
          const err = new Error("Transaction failed due to a serialization failure.") as Error & { code?: string };
          err.code = "P2034";
          throw err;
        }

        return tx.user.findFirst();
      },
      { maxRetries: 3, enableJitter: false, initialBackoffMs: 5 }
    );

    expect(attemptsCount).toBe(2);
    expect(result).toBeDefined();
  });

  it("G4-RET-01 [Fault Injection Checkpoint]: Fault injection BEFORE_TRANSACTION_RETURN forces transaction rollback", async () => {
    if (!safety.ok) return;

    const { user } = await createGate4User("tx-retry", "checkpoint", "CUSTOMER");
    requireGate4Fixture(user, "Customer user fixture required");

    const originalName = user.name;

    const unhook = registerFaultInjectionHook("BEFORE_TRANSACTION_RETURN", () => {
      throw new Error("INJECTED_CHECKPOINT_FAILURE_BEFORE_COMMIT");
    });

    try {
      const attempt = runTransaction(
        async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { name: "NAME_SHOULD_ROLL_BACK" },
          });
        },
        { operationName: "test_checkpoint_rollback" }
      );

      await expect(attempt).rejects.toThrow("INJECTED_CHECKPOINT_FAILURE_BEFORE_COMMIT");

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.name).toBe(originalName);
    } finally {
      unhook();
      clearAllFaultInjectionHooks();
    }
  });

  it("G4-RET-01 [Non-Retryable Exception]: Business validation exception is NOT retried and fails fast", async () => {
    let callCount = 0;

    const failedTx = runSerializableTransaction(
      async () => {
        callCount += 1;
        throw new Error("BUSINESS_VALIDATION_ERROR: Insufficient funds.");
      },
      { maxRetries: 5, enableJitter: false }
    );

    await expect(failedTx).rejects.toThrow("BUSINESS_VALIDATION_ERROR");
    expect(callCount).toBe(1);
  });
});

