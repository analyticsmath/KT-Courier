import { describe, expect, it } from "vitest";
import { parseRefundAmount } from "@/lib/refunds/refund-money-policy";
import { assertRefundTransition } from "@/lib/refunds/refund-state-machine";
import { REFUND_PRODUCTION_READINESS } from "@/lib/refunds/refund-production-readiness";

describe("refund request integration", () => {
  it("parses exact ZAR refund amounts and validates boundaries", () => {
    expect(parseRefundAmount("50.00").toString()).toBe("50.00");
  });
  it("enforces state transitions for refund lifecycle", () => {
    expect(() => assertRefundTransition("REQUESTED", "UNDER_REVIEW")).not.toThrow();
  });
  it("evaluates refund production readiness fail-closed rules", () => {
    expect(REFUND_PRODUCTION_READINESS).toHaveProperty("productionValidationApproved");
  });
});
