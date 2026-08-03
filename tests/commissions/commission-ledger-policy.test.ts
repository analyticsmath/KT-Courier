import { describe, expect, it } from "vitest";
import { commissionAccrualPosting, commissionReversalPosting } from "@/lib/commissions/commission-ledger-policy";

describe("commission ledger policy", () => {
  it("debits held funds and credits revenue without cash or withdrawable", () => {
    const posting = commissionAccrualPosting({ accrualReference: "CA-1", heldAccountId: "held", allocations: [{ ruleId: "rule", rulePublicReference: "CR-1", ruleCode: "PLATFORM", allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", beneficiary: null, amount: "10.00", ledgerAccountId: "revenue", beneficiaryOwnerId: null, beneficiaryWalletId: null }], safeMetadata: { accrualReference: "CA-1", subjectReference: "ORD-1", settlementVersion: "settlement-1", planReference: "CP-1", planVersion: "1", allocationReferences: ["CR-1"], calculationVersion: "commission-v1" } });
    expect(posting.type).toBe("COMMISSION_ACCRUAL"); expect(posting.entries).toEqual(expect.arrayContaining([expect.objectContaining({ accountId: "held", direction: "DEBIT", amount: "10.00" }), expect.objectContaining({ accountId: "revenue", direction: "CREDIT", amount: "10.00" })]));
  });
  it("builds an exact inverse using the commission reversal journal type", () => {
    const posting = commissionReversalPosting({ accrualReference: "CA-1", originalJournalId: "journal", originalEntries: [{ accountId: "held", direction: "DEBIT", amount: "10.00", lineCode: "CUSTOMER_FUNDS_HELD" }, { accountId: "revenue", direction: "CREDIT", amount: "10.00", lineCode: "COMMISSION_CREDIT_1" }] });
    expect(posting.type).toBe("COMMISSION_REVERSAL"); expect(posting.reversalOfJournalId).toBe("journal"); expect(posting.entries).toEqual(expect.arrayContaining([expect.objectContaining({ accountId: "held", direction: "CREDIT" }), expect.objectContaining({ accountId: "revenue", direction: "DEBIT" })]));
  });
});
