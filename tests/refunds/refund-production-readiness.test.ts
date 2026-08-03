import { describe, expect, it } from "vitest";
import { assertRefundProductionActivation, REFUND_PRODUCTION_READINESS, REFUND_PRODUCTION_VALIDATION_APPROVED } from "@/lib/refunds/refund-production-readiness";

describe("refund production readiness", () => {
  it("is a reviewed source-level fail-closed constant without an environment bypass", () => {
    expect(REFUND_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(REFUND_PRODUCTION_READINESS).toEqual(expect.objectContaining({ known: true, networkActive: false, blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }));
    expect(() => assertRefundProductionActivation()).toThrow(/consolidated production validation/i);
  });
});
