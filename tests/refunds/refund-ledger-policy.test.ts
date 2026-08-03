import { describe, expect, it } from "vitest";
import { refundExternalPayoutPosting, refundReleasePosting, refundReservePosting, refundWalletCreditPosting } from "@/lib/refunds/refund-ledger-policy";

const funding = [{ publicReference: "RFA-1", sourceType: "CUSTOMER_FUNDS_HELD" as const, ledgerAccountId: "source", commissionAccrualId: null, commissionAllocationId: null, commissionAllocationReference: null, storeEarningId: null, driverEarningId: null, amount: "12.00" }];
const common = { refundReference: "R-1", paymentReference: "P-1", amount: "12.00", heldAccountId: "held" };

describe("refund ledger policy", () => {
  it("reserves by debiting exact sources and crediting held", () => expect(refundReservePosting({ ...common, method: "CUSTOMER_WALLET", reasonCode: "SERVICE_FAILURE", funding }).entries).toEqual(expect.arrayContaining([expect.objectContaining({ accountId: "source", direction: "DEBIT", amount: "12.00" }), expect.objectContaining({ accountId: "held", direction: "CREDIT", amount: "12.00" })])));
  it("releases as the exact inverse", () => expect(refundReleasePosting({ ...common, funding }).entries).toEqual(expect.arrayContaining([expect.objectContaining({ accountId: "held", direction: "DEBIT" }), expect.objectContaining({ accountId: "source", direction: "CREDIT" })])));
  it("credits a wallet without cash movement", () => expect(refundWalletCreditPosting({ ...common, walletAvailableAccountId: "wallet" }).entries).toEqual([expect.objectContaining({ accountId: "held", direction: "DEBIT" }), expect.objectContaining({ accountId: "wallet", direction: "CREDIT" })]));
  it("credits cash clearing for external completion and never posts a fee", () => {
    const posting = refundExternalPayoutPosting({ ...common, cashClearingAccountId: "cash", attemptReference: "A-1", providerRefundId: "PF-R-1" });
    expect(posting.entries).toEqual([expect.objectContaining({ accountId: "held", direction: "DEBIT" }), expect.objectContaining({ accountId: "cash", direction: "CREDIT" })]);
    expect(JSON.stringify(posting)).not.toMatch(/fee/i);
  });
});
