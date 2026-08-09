import { prisma } from "./prisma";
import { runTransaction, runSerializableTransaction, isRetryableTransactionError } from "./transaction-runner";
import { registerFaultInjectionHook, triggerFaultInjectionCheckpoint, clearAllFaultInjectionHooks } from "./fault-injection";

export {
  prisma,
  prisma as db,
  runTransaction,
  runSerializableTransaction,
  isRetryableTransactionError,
  registerFaultInjectionHook,
  triggerFaultInjectionCheckpoint,
  clearAllFaultInjectionHooks,
};

export default prisma;
