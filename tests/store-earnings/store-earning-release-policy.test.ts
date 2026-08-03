import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { assertStoreEarningReleaseEligible, storeEarningReleaseBlockReasons, type StoreEarningReleasePolicyInput } from "@/lib/store-earnings/store-earning-release-policy";

const eligible = (overrides: Partial<StoreEarningReleasePolicyInput> = {}): StoreEarningReleasePolicyInput => ({ status: "ACCRUED", productionValidationApproved: true, releaseEligibleAt: new Date("2026-07-17T00:00:00.000Z"), now: new Date("2026-07-18T00:00:00.000Z"), refundReservedAmount: new Prisma.Decimal(0), remainingAmount: new Prisma.Decimal(90), hasOpenEarningReconciliation: false, hasOpenRefundReconciliation: false, commissionAttributionCoherent: true, hasPaymentConflict: false, activeStore: true, validOwnerWithdrawableAccount: true, validStorePayableAccount: true, releaseLedgerJournalId: null, reversalLedgerJournalId: null, ...overrides });

describe("store earning release policy", () => {
  it("accepts only a mature, coherent, unreserved accrued entitlement", () => expect(() => assertStoreEarningReleaseEligible(eligible())).not.toThrow());
  it("blocks the source lock, early release, refunds, reconciliation, and downstream journals", () => expect(storeEarningReleaseBlockReasons(eligible({ productionValidationApproved: false, releaseEligibleAt: new Date("2026-07-19T00:00:00.000Z"), refundReservedAmount: new Prisma.Decimal("1.00"), hasOpenEarningReconciliation: true, releaseLedgerJournalId: "journal-1" }))).toEqual(expect.arrayContaining(["CONSOLIDATED_VALIDATION_NOT_APPROVED", "RELEASE_NOT_MATURE", "REFUND_RESERVATION_OPEN", "STORE_EARNING_RECONCILIATION_OPEN", "RELEASE_ALREADY_POSTED"])));
});
