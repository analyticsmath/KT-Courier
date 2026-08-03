import { describe, expect, it } from "vitest";
import { assertRefundTransition } from "@/lib/refunds/refund-state-machine";

describe("refund commission adjustment integration", () => {
  it("handles state transitions for refund commission adjustment", () => {
    expect(() => assertRefundTransition("UNDER_REVIEW", "APPROVED")).not.toThrow();
  });
});
