import { describe, expect, it } from "vitest";
import {
  assertExternalPayoutReference,
  assertPayoutDestinationExternalReference,
} from "@/lib/withdrawals/payout-reference-policy";

describe("payout reference policy", () => {
  it("rejects raw-number-like and unnamespaced references", () => {
    expect(assertExternalPayoutReference("manual-bank:PAY-mb-ref-1234")).toBe("manual-bank:PAY-mb-ref-1234");

    expect(() => assertExternalPayoutReference("123456789012")).toThrowError(/manual-bank/);
    expect(() => assertExternalPayoutReference("manual-bank:123456789")).toThrowError(/manual-bank/);
    expect(() => assertExternalPayoutReference("random-string-without-prefix")).toThrowError(/manual-bank/);

    expect(assertPayoutDestinationExternalReference("manual-finance:DEST-123")).toBe("manual-finance:DEST-123");
    expect(() => assertPayoutDestinationExternalReference("1234567")).toThrowError(/manual-finance/);
  });
});
