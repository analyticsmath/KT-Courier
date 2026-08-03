import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { assertDriverEarningReversalPolicy, DRIVER_EARNING_REVERSAL_REASON_CODES } from "@/lib/driver-earnings/driver-earning-reversal-policy";
it("contains only bounded reviewed reasons", () => expect(DRIVER_EARNING_REVERSAL_REASON_CODES).toHaveLength(7));
it("requires opaque evidence and no release/refund", () => expect(() => assertDriverEarningReversalPolicy({ status: "ACCRUED", releasedAmount: new Prisma.Decimal(0), refundReservedAmount: new Prisma.Decimal(0), remainingAmount: new Prisma.Decimal(10), releaseLedgerJournalId: null, reversalLedgerJournalId: null, commissionTreatmentCoherent: true, reviewedReconciliation: false, reversalEvidenceReference: "evidence:reviewed:17" })).not.toThrow());
