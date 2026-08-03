import { describe, expect, it } from "vitest";
import { assertRefundTransition, canTransitionRefund, isReservedRefundStatus, TERMINAL_REFUND_STATUSES } from "@/lib/refunds/refund-state-machine";
import type { RefundStatusCode } from "@/lib/refunds/types";

const expected: Record<RefundStatusCode, RefundStatusCode[]> = {
  REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PROCESSING", "SUCCEEDED", "CANCELLED"],
  PROCESSING: ["SUCCEEDED", "APPROVED", "RECONCILIATION_REQUIRED"],
  RECONCILIATION_REQUIRED: ["PROCESSING", "SUCCEEDED", "CANCELLED"],
  SUCCEEDED: [], REJECTED: [], CANCELLED: [],
};

describe("refund state machine", () => {
  it("allows exactly the architected transitions", () => {
    const statuses = Object.keys(expected) as RefundStatusCode[];
    for (const from of statuses) for (const to of statuses) {
      expect(canTransitionRefund(from, to), `${from} -> ${to}`).toBe(expected[from].includes(to));
    }
  });
  it("throws on an illegal transition", () => expect(() => assertRefundTransition("SUCCEEDED", "APPROVED")).toThrow(/cannot transition/i));
  it("classifies reserved and terminal states", () => {
    expect(isReservedRefundStatus("RECONCILIATION_REQUIRED")).toBe(true);
    expect(isReservedRefundStatus("SUCCEEDED")).toBe(false);
    expect(TERMINAL_REFUND_STATUSES).toEqual(["SUCCEEDED", "REJECTED", "CANCELLED"]);
  });
});
