import { describe, expect, it } from "vitest";
import { assertRefundTransition } from "@/lib/refunds/refund-state-machine";

describe("refund reconciliation integration", () => {
  it("handles state transitions for reconciliation cases", () => {
    expect(() => assertRefundTransition("PROCESSING", "RECONCILIATION_REQUIRED")).not.toThrow();
  });
});
