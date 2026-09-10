import { prisma } from "./prisma";
import { runTransaction, runSerializableTransaction, isRetryableTransactionError } from "./transaction-runner";
import { withSerializableRetry, isSerializableConcurrencyError } from "./serializable-retry";
import { registerFaultInjectionHook, triggerFaultInjectionCheckpoint, clearAllFaultInjectionHooks } from "./fault-injection";

export {
  prisma,
  prisma as db,
  runTransaction,
  runSerializableTransaction,
  isRetryableTransactionError,
  withSerializableRetry,
  isSerializableConcurrencyError,
  registerFaultInjectionHook,
  triggerFaultInjectionCheckpoint,
  clearAllFaultInjectionHooks,
};

export default prisma;
