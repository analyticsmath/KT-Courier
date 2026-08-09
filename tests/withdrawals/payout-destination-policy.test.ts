import { describe, expect, it } from "vitest";
import {
  assertPayoutDestinationExternalReference,
  assertMaskedDestinationMetadata,
} from "@/lib/withdrawals/payout-reference-policy";

describe("payout destination policy", () => {
  it("covers ownership, lifecycle, and masked metadata", () => {
    expect(() =>
      assertPayoutDestinationExternalReference("manual-finance:fNB-acc-1234")
    ).not.toThrow();

    expect(() =>
      assertPayoutDestinationExternalReference("raw-un-namespaced-reference")
    ).toThrowError(/manual-finance/);

    expect(() =>
      assertMaskedDestinationMetadata({
        maskedLabel: "First National Bank ****5678",
        accountLast4: "5678",
      })
    ).not.toThrow();

    expect(() =>
      assertMaskedDestinationMetadata({
        maskedLabel: "1234567890123456", // Raw unmasked account number
        accountLast4: "5678",
      })
    ).toThrowError(/masked/);
  });
});
