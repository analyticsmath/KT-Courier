import { describe, expect, it } from "vitest";
import {
  withdrawalReservePosting,
  withdrawalReleasePosting,
  withdrawalPayoutPosting,
} from "@/lib/withdrawals/withdrawal-ledger-policy";

describe("withdrawal account policy", () => {
  it("covers only owner-withdrawable and withdrawal-held liability accounts", () => {
    const input = {
      withdrawalReference: "WD-100",
      amount: "500.00",
      sourceAccountId: "acc-withdrawable",
      heldAccountId: "acc-held",
      cashClearingAccountId: "acc-cash",
      actorUserId: "user-1",
      payoutDestinationReference: "PD-1",
      ownerType: "STORE",
      policyVersion: 1,
    };

    const reserve = withdrawalReservePosting(input);
    expect(reserve.type).toBe("WITHDRAWAL_RESERVE");
    expect(reserve.entries[0]).toEqual({
      accountId: "acc-withdrawable",
      direction: "DEBIT",
      amount: "500.00",
      lineCode: "OWNER_WITHDRAWABLE_DEBIT",
      memo: "Withdrawable funds reserved",
    });
    expect(reserve.entries[1]).toEqual({
      accountId: "acc-held",
      direction: "CREDIT",
      amount: "500.00",
      lineCode: "WITHDRAWAL_HELD_CREDIT",
      memo: "Withdrawal funds held",
    });

    const release = withdrawalReleasePosting(input);
    expect(release.type).toBe("WITHDRAWAL_RELEASE");

    const payout = withdrawalPayoutPosting(input);
    expect(payout.type).toBe("WITHDRAWAL_PAYOUT");
    expect(payout.entries[1].accountId).toBe("acc-cash");
  });
});
