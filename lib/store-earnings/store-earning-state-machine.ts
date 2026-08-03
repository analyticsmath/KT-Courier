import { StoreEarningError } from "./errors";

export const STORE_EARNING_STATUSES = ["ACCRUED", "RELEASED", "FULLY_REFUNDED", "REVERSED", "RECONCILIATION_REQUIRED"] as const;
export type StoreEarningStatusCode = (typeof STORE_EARNING_STATUSES)[number];

const transitions: Readonly<Record<StoreEarningStatusCode, readonly StoreEarningStatusCode[]>> = Object.freeze({
  ACCRUED: Object.freeze(["RELEASED", "FULLY_REFUNDED", "REVERSED", "RECONCILIATION_REQUIRED"] as const),
  RECONCILIATION_REQUIRED: Object.freeze(["ACCRUED", "RELEASED", "FULLY_REFUNDED", "REVERSED"] as const),
  RELEASED: Object.freeze([]),
  FULLY_REFUNDED: Object.freeze([]),
  REVERSED: Object.freeze([]),
});

export function isTerminalStoreEarningStatus(status: StoreEarningStatusCode): boolean {
  return status === "RELEASED" || status === "FULLY_REFUNDED" || status === "REVERSED";
}

export function assertStoreEarningTransition(from: StoreEarningStatusCode, to: StoreEarningStatusCode): void {
  if (!transitions[from].includes(to)) {
    throw new StoreEarningError("STORE_EARNING_INVALID_STATE", `Store earning transition ${from} to ${to} is not permitted.`);
  }
}
