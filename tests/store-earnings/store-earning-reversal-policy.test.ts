import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertStoreEarningReversalPolicy } from "@/lib/store-earnings/store-earning-reversal-policy";

const allowed = { status: "ACCRUED", releasedAmount: new Prisma.Decimal(0), refundReservedAmount: new Prisma.Decimal(0), remainingAmount: new Prisma.Decimal("80.00"), releaseLedgerJournalId: null, reversalLedgerJournalId: null, commissionTreatmentCoherent: true, reviewedReconciliation: false, reconciliationCases: [] };

describe("store earning reversal policy", () => {
  it("allows exact remaining entitlement before release", () => expect(() => assertStoreEarningReversalPolicy(allowed)).not.toThrow());
  it("blocks release evidence", () => expect(() => assertStoreEarningReversalPolicy({ ...allowed, releasedAmount: new Prisma.Decimal("1.00"), releaseLedgerJournalId: "release-1" })).toThrow());
  it("blocks reversal until related commission treatment is coherent", () => expect(() => assertStoreEarningReversalPolicy({ ...allowed, commissionTreatmentCoherent: false })).toThrow());
  for (const status of ["OPEN", "MONITORING"]) {
    it(`blocks ${status} application failures even when the earning remains accrued`, () => {
      expect(() => assertStoreEarningReversalPolicy({ ...allowed, reconciliationCases: [{ reason: "APPLICATION_FAILURE", status }] })).toThrow();
    });
  }
  it("allows resolved application failures", () => expect(() => assertStoreEarningReversalPolicy({ ...allowed, reconciliationCases: [{ reason: "APPLICATION_FAILURE", status: "RESOLVED" }] })).not.toThrow());
  it("does not let a reviewed commission case override another unresolved case", () => {
    expect(() => assertStoreEarningReversalPolicy({ ...allowed, status: "RECONCILIATION_REQUIRED", reviewedReconciliation: true, reconciliationCases: [{ reason: "REVERSAL_BLOCKED_BY_COMMISSION", status: "OPEN" }, { reason: "APPLICATION_FAILURE", status: "OPEN" }] })).toThrow();
  });
  it("allows the existing coherent commission-reversal recovery", () => {
    expect(() => assertStoreEarningReversalPolicy({ ...allowed, status: "RECONCILIATION_REQUIRED", reviewedReconciliation: true, reconciliationCases: [{ reason: "REVERSAL_BLOCKED_BY_COMMISSION", status: "OPEN" }] })).not.toThrow();
  });
});
