/** Repository-owned fulfilment composition is active. External providers stay
 * independently fail-closed at their own boundaries. */
export const STORE_ORDER_PRODUCTION_VALIDATION_APPROVED = true as const;
export const STORE_ORDER_PRODUCTION_BLOCK_REASON = "STORE_ORDER_PRODUCTION_NOT_READY" as const;

export type StoreOrderProductionOperation =
  | "POLICY_ACTIVATION"
  | "OPERATIONAL_SNAPSHOT"
  | "REVIEW"
  | "AVAILABILITY"
  | "ACCEPTANCE"
  | "REJECTION"
  | "SUBSTITUTION"
  | "ADJUSTMENT"
  | "REFUND"
  | "PREPARATION"
  | "DELIVERY_BRIDGE"
  | "HANDOFF"
  | "RECONCILIATION";

export class StoreOrderProductionLockedError extends Error {
  readonly code = STORE_ORDER_PRODUCTION_BLOCK_REASON;

  constructor(readonly operation: StoreOrderProductionOperation) {
    super(`${operation} is inactive until its required authority is available.`);
    this.name = "StoreOrderProductionLockedError";
  }
}

/** There is deliberately no environment-variable or test-only bypass. */
export function assertStoreOrderProductionReady(operation: StoreOrderProductionOperation, _testApproval?: { approved: true }): void {
  void _testApproval;
  if (STORE_ORDER_PRODUCTION_VALIDATION_APPROVED) return;
  throw new StoreOrderProductionLockedError(operation);
}

export function storeOrderProductionReady(): boolean {
  return STORE_ORDER_PRODUCTION_VALIDATION_APPROVED;
}
