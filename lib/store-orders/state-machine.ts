import { StoreOrderError } from "@/lib/store-orders/errors";

type Acceptance = "PENDING_STORE_REVIEW" | "REVIEWING" | "CUSTOMER_ACTION_REQUIRED" | "ACCEPTED" | "REJECTED" | "TIMED_OUT";
type Preparation = "NOT_STARTED" | "PREPARING" | "READY_FOR_HANDOFF" | "HANDED_OFF" | "ABORTED";
type Resolution = "CLEAR" | "ISSUE_OPEN" | "ADJUSTMENT_PENDING" | "REFUND_PENDING" | "RECONCILIATION_REQUIRED" | "RESOLVED";
type Financial = "UNCHANGED" | "ADJUSTMENT_CALCULATED" | "REVERSAL_PENDING" | "REFUND_RESERVED" | "REFUND_PROCESSING" | "REFUND_COMPLETED" | "RECONCILIATION_REQUIRED";

const transitions = {
  acceptance: {
    PENDING_STORE_REVIEW: ["REVIEWING", "CUSTOMER_ACTION_REQUIRED", "REJECTED", "TIMED_OUT"],
    REVIEWING: ["PENDING_STORE_REVIEW", "CUSTOMER_ACTION_REQUIRED", "ACCEPTED", "REJECTED", "TIMED_OUT"],
    CUSTOMER_ACTION_REQUIRED: ["REVIEWING", "REJECTED", "TIMED_OUT"],
    ACCEPTED: [], REJECTED: [], TIMED_OUT: [],
  },
  preparation: {
    NOT_STARTED: ["PREPARING", "ABORTED"], PREPARING: ["READY_FOR_HANDOFF", "ABORTED"],
    READY_FOR_HANDOFF: ["HANDED_OFF", "ABORTED"], HANDED_OFF: [], ABORTED: [],
  },
  resolution: {
    CLEAR: ["ISSUE_OPEN", "ADJUSTMENT_PENDING", "RECONCILIATION_REQUIRED", "RESOLVED"],
    ISSUE_OPEN: ["ADJUSTMENT_PENDING", "REFUND_PENDING", "RESOLVED", "RECONCILIATION_REQUIRED"],
    ADJUSTMENT_PENDING: ["REFUND_PENDING", "RESOLVED", "RECONCILIATION_REQUIRED"],
    REFUND_PENDING: ["RESOLVED", "RECONCILIATION_REQUIRED"], RECONCILIATION_REQUIRED: ["RESOLVED"], RESOLVED: [],
  },
  financial: {
    UNCHANGED: ["ADJUSTMENT_CALCULATED", "RECONCILIATION_REQUIRED"],
    ADJUSTMENT_CALCULATED: ["REVERSAL_PENDING", "REFUND_RESERVED", "REFUND_COMPLETED", "RECONCILIATION_REQUIRED"],
    REVERSAL_PENDING: ["REFUND_RESERVED", "RECONCILIATION_REQUIRED"],
    REFUND_RESERVED: ["REFUND_PROCESSING", "REFUND_COMPLETED", "RECONCILIATION_REQUIRED"],
    REFUND_PROCESSING: ["REFUND_COMPLETED", "RECONCILIATION_REQUIRED"],
    REFUND_COMPLETED: [], RECONCILIATION_REQUIRED: ["REFUND_COMPLETED"],
  },
} as const;

function canTransition<T extends keyof typeof transitions>(kind: T, from: keyof (typeof transitions)[T], to: string): boolean {
  return (transitions[kind][from] as readonly string[]).includes(to);
}

export function assertAcceptanceTransition(from: Acceptance, to: Acceptance): void {
  if (!canTransition("acceptance", from, to)) throw new StoreOrderError("STORE_ORDER_INVALID_STATE", "Store acceptance cannot transition to that state.");
}
export function assertPreparationTransition(from: Preparation, to: Preparation): void {
  if (!canTransition("preparation", from, to)) throw new StoreOrderError("STORE_ORDER_INVALID_STATE", "Store preparation cannot transition to that state.");
}
export function assertResolutionTransition(from: Resolution, to: Resolution): void {
  if (!canTransition("resolution", from, to)) throw new StoreOrderError("STORE_ORDER_INVALID_STATE", "Store resolution cannot transition to that state.");
}
export function assertFinancialTransition(from: Financial, to: Financial): void {
  if (!canTransition("financial", from, to)) throw new StoreOrderError("STORE_ORDER_INVALID_STATE", "Financial resolution cannot transition to that state.");
}

export function deriveStoreOrderStatus(input: Readonly<{ acceptance: Acceptance; preparation: Preparation; resolution: Resolution; delivery: string }>) {
  if (input.resolution === "RECONCILIATION_REQUIRED") return "RECONCILIATION_REQUIRED" as const;
  if (["REJECTED", "TIMED_OUT"].includes(input.acceptance) || input.preparation === "ABORTED") return "REJECTED_OR_CANCELLED" as const;
  if (input.preparation === "HANDED_OFF" || input.delivery === "HANDED_OFF") return "HANDED_OFF_TO_COURIER" as const;
  if (input.preparation === "READY_FOR_HANDOFF") return input.delivery === "DRIVER_ASSIGNED" || input.delivery === "HANDOFF_READY" ? "HANDOFF_IN_PROGRESS" as const : "READY_FOR_PICKUP" as const;
  if (input.preparation === "PREPARING") return "PREPARING" as const;
  if (input.acceptance === "CUSTOMER_ACTION_REQUIRED" || input.resolution === "ISSUE_OPEN") return "CUSTOMER_ACTION_REQUIRED" as const;
  if (input.acceptance === "ACCEPTED") return "ACCEPTED" as const;
  return "AWAITING_STORE_REVIEW" as const;
}
