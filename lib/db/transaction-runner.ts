import { Prisma, PrismaClient } from "@prisma/client";
import { prisma as rootPrisma } from "./prisma";
import { triggerFaultInjectionCheckpoint } from "./fault-injection";

export type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface TransactionRunnerOptions {
  /**
   * Desired transaction isolation level.
   * Default: ReadCommitted
   */
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /**
   * Maximum transaction wait time in milliseconds.
   * Default: 5000ms
   */
  maxWait?: number;
  /**
   * Maximum transaction execution timeout in milliseconds.
   * Default: 10000ms
   */
  timeout?: number;
  /**
   * Maximum retry attempts for retryable serialization/deadlock errors (P2034 / 40001 / 40P01).
   * Default: 3 for Serializable, 0 for ReadCommitted
   */
  maxRetries?: number;
  /**
   * Initial backoff delay in milliseconds.
   * Default: 20ms
   */
  initialBackoffMs?: number;
  /**
   * Maximum backoff delay in milliseconds.
   * Default: 500ms
   */
  maxBackoffMs?: number;
  /**
   * Enable/disable backoff jitter for deterministic unit testing.
   * Default: true
   */
  enableJitter?: boolean;
  /**
   * Human-readable operation name for structured diagnostic metadata.
   */
  operationName?: string;
}

const RETRYABLE_PRISMA_CODES = new Set(["P2034", "P2002"]);
const RETRYABLE_SQLSTATES = new Set(["40001", "40P01"]);

export function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const prismaCode = (error as { code?: string }).code ?? "";
  const dbCode = (error as { meta?: { code?: string } }).meta?.code ?? "";
  const message = (error as { message?: string }).message ?? "";

  return (
    RETRYABLE_PRISMA_CODES.has(prismaCode) ||
    RETRYABLE_SQLSTATES.has(dbCode) ||
    message.includes("40001") ||
    message.includes("40P01") ||
    message.includes("could not serialize access") ||
    message.includes("deadlock detected")
  );
}

export function calculateBackoff(
  attempt: number,
  initialBackoffMs = 20,
  maxBackoffMs = 500,
  enableJitter = true
): number {
  const exponential = Math.min(maxBackoffMs, initialBackoffMs * 2 ** attempt);
  if (!enableJitter) return exponential;
  const jitter = Math.floor(Math.random() * (initialBackoffMs / 2));
  return exponential + jitter;
}

/**
 * Runs a callback inside a Prisma interactive transaction with configurable isolation level,
 * automatic bounded retries on serialization/deadlock failures, and checkpoint fault injection support.
 */
export async function runTransaction<T>(
  work: (tx: PrismaTransactionClient) => Promise<T>,
  options: TransactionRunnerOptions = {},
  client: PrismaClient = rootPrisma
): Promise<T> {
  const isolationLevel = options.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted;
  const isSerializable = isolationLevel === Prisma.TransactionIsolationLevel.Serializable;
  const maxRetries = options.maxRetries ?? (isSerializable ? 3 : 0);
  const initialBackoffMs = options.initialBackoffMs ?? 20;
  const maxBackoffMs = options.maxBackoffMs ?? 500;
  const enableJitter = options.enableJitter ?? true;
  const operationName = options.operationName ?? "anonymous_transaction";

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await client.$transaction(
        async (tx) => {
          const result = await work(tx);
          await triggerFaultInjectionCheckpoint("BEFORE_TRANSACTION_RETURN", { operationName, attempt });
          return result;
        },
        {
          isolationLevel,
          maxWait: options.maxWait ?? 5000,
          timeout: options.timeout ?? 10000,
        }
      );
    } catch (error) {
      lastError = error;

      if (!isRetryableTransactionError(error) || attempt >= maxRetries) {
        throw error;
      }

      const backoff = calculateBackoff(attempt, initialBackoffMs, maxBackoffMs, enableJitter);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError;
}

/**
 * Wrapper for serializable transactions with retries.
 */
export async function runSerializableTransaction<T>(
  work: (tx: PrismaTransactionClient) => Promise<T>,
  options: Omit<TransactionRunnerOptions, "isolationLevel"> = {},
  client: PrismaClient = rootPrisma
): Promise<T> {
  return runTransaction(work, { ...options, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }, client);
}
