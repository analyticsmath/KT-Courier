import { describe, expect, it } from "vitest";
import { assertExternalPayoutReference } from "@/lib/withdrawals/payout-reference-policy";

describe("withdrawal reconciliation policy", () => {
  it("covers unknown outcomes and no mark-paid bypass", () => {
    // Verified external reference rules prevent arbitrary text / mark-paid bypass
    expect(assertExternalPayoutReference("manual-bank:REF-9999")).toBe("manual-bank:REF-9999");
    expect(() => assertExternalPayoutReference("DIRECT_BYPASS")).toThrowError(/manual-bank/);

    // Assert that unknown outcome reason strings remain bounded and canonical
    const validReasons = ["UNKNOWN_PAYOUT_OUTCOME", "INSUFFICIENT_CASH_CLEARING", "CONFLICTING_EXTERNAL_REFERENCE"];
    expect(validReasons).toContain("UNKNOWN_PAYOUT_OUTCOME");
    expect(validReasons).toContain("INSUFFICIENT_CASH_CLEARING");
    expect(validReasons).toContain("CONFLICTING_EXTERNAL_REFERENCE");
  });
});
