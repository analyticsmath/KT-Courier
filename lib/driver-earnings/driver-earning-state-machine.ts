import { DriverEarningError } from "./errors";

export const DRIVER_EARNING_STATUSES = ["ACCRUED", "RECONCILIATION_REQUIRED", "RELEASED", "FULLY_REFUNDED", "REVERSED"] as const;
export type DriverEarningStatusCode = (typeof DRIVER_EARNING_STATUSES)[number];
const transitions: Readonly<Record<DriverEarningStatusCode, readonly DriverEarningStatusCode[]>> = Object.freeze({
  ACCRUED: Object.freeze(["RELEASED", "FULLY_REFUNDED", "REVERSED", "RECONCILIATION_REQUIRED"] as const),
  RECONCILIATION_REQUIRED: Object.freeze(["ACCRUED", "RELEASED", "FULLY_REFUNDED", "REVERSED"] as const),
  RELEASED: Object.freeze([] as const), FULLY_REFUNDED: Object.freeze([] as const), REVERSED: Object.freeze([] as const),
});
export const isTerminalDriverEarningStatus = (status: DriverEarningStatusCode) => status === "RELEASED" || status === "FULLY_REFUNDED" || status === "REVERSED";
export function assertDriverEarningTransition(from: DriverEarningStatusCode, to: DriverEarningStatusCode): void { if (!transitions[from].includes(to)) throw new DriverEarningError("DRIVER_EARNING_INVALID_STATE", `Driver earning transition ${from} to ${to} is not permitted.`); }
