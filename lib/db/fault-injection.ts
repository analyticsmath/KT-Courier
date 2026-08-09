/**
 * Test-only fault-injection framework for transaction checkpoint testing.
 * Permits tests to register callbacks/errors at specific transaction lifecycle checkpoints.
 * Default behavior in production is a complete no-op.
 */

export type FaultInjectionCheckpoint =
  | "AFTER_PRIMARY_STATE_WRITE"
  | "BEFORE_LEDGER_WRITE"
  | "AFTER_LEDGER_WRITE"
  | "BEFORE_OUTBOX_WRITE"
  | "AFTER_OUTBOX_WRITE"
  | "BEFORE_TRANSACTION_RETURN";

export type FaultInjectionCallback = (checkpoint: FaultInjectionCheckpoint, context?: Record<string, unknown>) => void | Promise<void>;

const registeredHooks: Map<FaultInjectionCheckpoint, FaultInjectionCallback[]> = new Map();

/**
 * Registers a fault-injection hook for a specific checkpoint.
 * Returns an unregister function.
 */
export function registerFaultInjectionHook(
  checkpoint: FaultInjectionCheckpoint,
  callback: FaultInjectionCallback
): () => void {
  const list = registeredHooks.get(checkpoint) ?? [];
  list.push(callback);
  registeredHooks.set(checkpoint, list);

  return () => {
    const current = registeredHooks.get(checkpoint) ?? [];
    const index = current.indexOf(callback);
    if (index !== -1) {
      current.splice(index, 1);
    }
  };
}

/**
 * Triggers any registered hooks for the specified checkpoint.
 * If a hook throws an error, the error propagates and causes transaction rollback.
 */
export async function triggerFaultInjectionCheckpoint(
  checkpoint: FaultInjectionCheckpoint,
  context?: Record<string, unknown>
): Promise<void> {
  const hooks = registeredHooks.get(checkpoint);
  if (!hooks || hooks.length === 0) return;

  for (const hook of [...hooks]) {
    await hook(checkpoint, context);
  }
}

/**
 * Clears all registered fault-injection hooks. Used in test teardown.
 */
export function clearAllFaultInjectionHooks(): void {
  registeredHooks.clear();
}
