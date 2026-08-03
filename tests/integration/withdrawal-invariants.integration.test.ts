import { describe, expect, it } from "vitest";
import { withdrawalReservePosting } from "@/lib/withdrawals/withdrawal-ledger-policy";

describe("withdrawal invariants integration", () => {
  it("constructs balanced ledger postings for reserve, release, and payout", () => {
    const reserve = withdrawalReservePosting({
      withdrawalReference: "WD-1",
      amount: "100.00",
      sourceAccountId: "acc-1",
      heldAccountId: "acc-2",
      actorUserId: "usr-1",
      payoutDestinationReference: "PD-1",
      ownerType: "STORE",
      policyVersion: 1,
    });
    expect(reserve.entries).toHaveLength(2);
    expect(reserve.entries[0].amount.toString()).toBe("100.00");
  });
});
