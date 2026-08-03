export const STORE_ORDER_PRODUCTION_VALIDATION_APPROVED = false as const;
export const STORE_ORDER_PRODUCTION_BLOCK_REASON = "STORE_ORDER_CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

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
    super(`${operation} is inactive until Phase 26.5 consolidated validation is approved.`);
    this.name = "StoreOrderProductionLockedError";
  }
}

/** There is deliberately no environment-variable bypass. */
export function assertStoreOrderProductionReady(operation: StoreOrderProductionOperation, testApproval?: { approved: true }): void {
  if (STORE_ORDER_PRODUCTION_VALIDATION_APPROVED || testApproval?.approved === true) return;
  throw new StoreOrderProductionLockedError(operation);
}

export function storeOrderProductionReady(): boolean {
  return STORE_ORDER_PRODUCTION_VALIDATION_APPROVED;
}
