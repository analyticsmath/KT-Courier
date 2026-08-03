import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertStoreEarningReversalPolicy } from "@/lib/store-earnings/store-earning-reversal-policy";

const allowed = { status: "ACCRUED", releasedAmount: new Prisma.Decimal(0), refundReservedAmount: new Prisma.Decimal(0), remainingAmount: new Prisma.Decimal("80.00"), releaseLedgerJournalId: null, reversalLedgerJournalId: null, commissionTreatmentCoherent: true, reviewedReconciliation: false };

describe("store earning reversal policy", () => {
  it("allows exact remaining entitlement before release", () => expect(() => assertStoreEarningReversalPolicy(allowed)).not.toThrow());
  it("blocks release evidence", () => expect(() => assertStoreEarningReversalPolicy({ ...allowed, releasedAmount: new Prisma.Decimal("1.00"), releaseLedgerJournalId: "release-1" })).toThrow());
  it("blocks reversal until related commission treatment is coherent", () => expect(() => assertStoreEarningReversalPolicy({ ...allowed, commissionTreatmentCoherent: false })).toThrow());
});
