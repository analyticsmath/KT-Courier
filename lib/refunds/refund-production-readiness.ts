import { RefundError } from "./errors";

export const REFUND_PRODUCTION_VALIDATION_APPROVED = false as const;

export const REFUND_PRODUCTION_READINESS = Object.freeze({
  known: true,
  configured: false,
  networkActive: false,
  productionValidationApproved: REFUND_PRODUCTION_VALIDATION_APPROVED,
  blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const,
});

export function assertRefundProductionActivation(): never {
  throw new RefundError(
    "REFUND_PRODUCTION_NOT_READY",
    "Refund operations are unavailable until consolidated production validation is approved.",
  );
}

