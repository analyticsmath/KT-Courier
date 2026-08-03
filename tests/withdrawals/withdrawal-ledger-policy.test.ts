import { describe, expect, it } from "vitest";
import { withdrawalPayoutPosting, withdrawalReleasePosting, withdrawalReservePosting } from "@/lib/withdrawals/withdrawal-ledger-policy";

const input = { withdrawalReference: "WD-TEST", amount: "10.00", sourceAccountId: "source", heldAccountId: "held", cashClearingAccountId: "cash", actorUserId: "actor", payoutDestinationReference: "PD-TEST", ownerType: "STORE", policyVersion: 1 };
describe("withdrawal ledger policy", () => {
  it("reserves from withdrawable liability into held liability", () => { const posting = withdrawalReservePosting(input); expect(posting.type).toBe("WITHDRAWAL_RESERVE"); expect(posting.entries).toEqual(expect.arrayContaining([expect.objectContaining({ accountId: "source", direction: "DEBIT" }), expect.objectContaining({ accountId: "held", direction: "CREDIT" })])); });
  it("releases held liability back to withdrawable liability", () => { const posting = withdrawalReleasePosting(input); expect(posting.type).toBe("WITHDRAWAL_RELEASE"); expect(posting.entries[0]).toMatchObject({ accountId: "held", direction: "DEBIT" }); expect(posting.entries[1]).toMatchObject({ accountId: "source", direction: "CREDIT" }); });
  it("settles held liability by crediting platform cash without fee or revenue lines", () => { const posting = withdrawalPayoutPosting(input); expect(posting.type).toBe("WITHDRAWAL_PAYOUT"); expect(posting.entries).toHaveLength(2); expect(posting.entries[0]).toMatchObject({ accountId: "held", direction: "DEBIT" }); expect(posting.entries[1]).toMatchObject({ accountId: "cash", direction: "CREDIT" }); });
});
