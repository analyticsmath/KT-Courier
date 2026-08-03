import { describe, expect, it } from "vitest";
import { storeEarningAccrualPosting, storeEarningReleasePosting, storeEarningReversalPosting } from "@/lib/store-earnings/store-earning-ledger-policy";

const common = { earningReference: "SE-1", amount: "90.00", storePayableAccountId: "store-payable", customerFundsHeldAccountId: "customer-held", storePublicReference: "STORE-1", subjectPublicReference: "ORDER-1", settlementVersion: "v1" };

describe("store earning ledger policy", () => {
  it("accrues held funds into store payable without cash or withdrawable", () => {
    const posting = storeEarningAccrualPosting({ ...common, paymentPublicReference: "PAY-1" });
    expect(posting.entries).toEqual([{ accountId: "customer-held", direction: "DEBIT", amount: "90.00", lineCode: "CUSTOMER_FUNDS_HELD" }, { accountId: "store-payable", direction: "CREDIT", amount: "90.00", lineCode: "STORE_EARNINGS_PAYABLE" }]);
    expect(JSON.stringify(posting)).not.toMatch(/CASH_CLEARING|OWNER_WITHDRAWABLE/);
  });
  it("releases payable into the Phase 13 withdrawable account without cash", () => expect(storeEarningReleasePosting({ ...common, ownerWithdrawableAccountId: "withdrawable", paymentPublicReference: "PAY-1", releaseEligibleAt: "2026-07-18T00:00:00.000Z" }).entries).toEqual([{ accountId: "store-payable", direction: "DEBIT", amount: "90.00", lineCode: "STORE_EARNINGS_PAYABLE" }, { accountId: "withdrawable", direction: "CREDIT", amount: "90.00", lineCode: "OWNER_WITHDRAWABLE" }]));
  it("reverses payable to customer-held funds", () => expect(storeEarningReversalPosting({ ...common, reasonCode: "SETTLEMENT_INVALIDATED" }).entries).toEqual([{ accountId: "store-payable", direction: "DEBIT", amount: "90.00", lineCode: "STORE_EARNINGS_PAYABLE" }, { accountId: "customer-held", direction: "CREDIT", amount: "90.00", lineCode: "CUSTOMER_FUNDS_HELD" }]));
});
