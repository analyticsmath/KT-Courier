import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { assertCommittedMarketplaceAdjustmentFunding } from "@/lib/services/marketplace-adjustment-refund-authority";
const d = (value: string) => new Prisma.Decimal(value);
function source(fee = "0.00") {
  const refund = d("100.00").add(fee);
  const snapshot = { publicReference: "snapshot-owned", sourcePaymentId: "payment-owned", commissionAccrualReference: "commission-owned", storeEarningReference: "earning-owned", settlementVersion: "phase20-v1", sellerBasis: d("100.00"), deliveryFeeResidual: d(fee) };
  const adjustment = { id: "adjustment-owned", publicReference: "adjustment-reference", status: "APPLYING", adjustmentType: "FULL_STORE_REJECTION", sourceVersion: "phase20-v1", refundAmount: refund, deliveryFeeAmount: d(fee), financialEvidence: { phase21CommittedReversals: { operationId: "canonical-operation", refundAmount: refund.toFixed(2), commissionReversalReferences: ["commission-journal"], storeEarningReversalReference: "earning-journal" }, unearnedDeliveryFee: { settlementSnapshotReference: snapshot.publicReference, amount: fee, preparationStatus: "NOT_STARTED", bridgeAbsent: true } }, storeOrder: { id: "child-owned", acceptanceStatus: "REJECTED", preparationStatus: "ABORTED", deliveryFee: d(fee), deliveryBridge: null as unknown, settlementSnapshots: [snapshot], marketplaceOrder: { paymentId: "payment-owned", customerUserId: "customer-owned" } } };
  const journal = (reference: string, amount: string, earning: boolean) => ({ reference, type: earning ? "STORE_EARNING_REVERSAL" : "ACCOUNT_TRANSFER", currency: "ZAR", totalDebits: d(amount), totalCredits: d(amount), metadata: earning ? { earningReference: "earning-owned", operationId: "canonical-operation:store-earning" } : { accrualReference: "commission-owned", allocationReference: "allocation-owned", operationId: "canonical-operation:commission:allocation-owned" }, entries: [{ direction: "DEBIT", accountId: "source-liability", amount: d(amount) }, { direction: "CREDIT", accountId: "held-owned", amount: d(amount) }] });
  const journals = [journal("commission-journal", "10.00", false), journal("earning-journal", "90.00", true)];
  const capture = { type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", totalDebits: refund, totalCredits: refund, entries: [{ direction: "CREDIT", amount: refund, account: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" } }] };
  const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: adjustment.id }]), marketplaceStoreOrderAdjustment: { findUnique: vi.fn().mockResolvedValue(adjustment), findMany: vi.fn().mockResolvedValue([]) }, marketplaceStoreOrderLineFulfilment: { count: vi.fn().mockResolvedValue(0) }, payment: { findUnique: vi.fn().mockResolvedValue({ status: "SUCCEEDED", amount: refund, successLedgerJournal: capture }) }, marketplaceSettlementSnapshot: { findMany: vi.fn().mockResolvedValue([snapshot]) }, ledgerAccount: { findUnique: vi.fn().mockResolvedValue({ id: "held-owned" }) }, ledgerJournal: { findMany: vi.fn().mockResolvedValue(journals) }, paymentRefund: { findFirst: vi.fn().mockResolvedValue(null) } };
  const input = { adjustmentReference: adjustment.publicReference, paymentId: "payment-owned", operationId: "canonical-operation:refund", amount: refund.toString(), customerUserId: "customer-owned" };
  return { adjustment, snapshot, journals, capture, tx, input, check: () => assertCommittedMarketplaceAdjustmentFunding(tx as unknown as Prisma.TransactionClient, input) };
}
describe("committed store adjustment funding policy (in-memory source contracts)", () => {
  it("compares equivalent decimal representations without losing the bound refund authority", async () => { const f = source(); await expect(f.check()).resolves.toBeUndefined(); expect(f.input.amount).toBe("100"); });
  it("requires both exact reversal journals plus the independent unearned capture residual", async () => { await expect(source("10.00").check()).resolves.toBeUndefined(); });
  for (const changed of ["foreign-payment", "foreign-customer", "wrong-amount", "wrong-operation", "wrong-version", "foreign-reversal", "unbalanced-reversal"] as const) it(`denies ${changed}`, async () => {
    const f = source();
    if (changed === "foreign-payment") f.input.paymentId = "foreign";
    if (changed === "foreign-customer") f.input.customerUserId = "foreign";
    if (changed === "wrong-amount") f.input.amount = "99.99";
    if (changed === "wrong-operation") f.input.operationId = "foreign:refund";
    if (changed === "wrong-version") f.snapshot.settlementVersion = "foreign";
    if (changed === "foreign-reversal") f.journals[0].metadata.accrualReference = "foreign";
    if (changed === "unbalanced-reversal") f.journals[0].totalCredits = d("9.99");
    await expect(f.check()).rejects.toMatchObject({ code: "REFUND_FUNDING_UNAVAILABLE" });
  });
  for (const changed of ["accepted", "prepared", "courier", "handed-off", "foreign-capture", "fee-already-refunded", "wrong-fee-proof"] as const) it(`denies unearned fee when ${changed}`, async () => {
    const f = source("10.00");
    if (changed === "accepted") f.adjustment.storeOrder.acceptanceStatus = "ACCEPTED";
    if (changed === "prepared") f.adjustment.storeOrder.preparationStatus = "PREPARING";
    if (changed === "courier") f.adjustment.storeOrder.deliveryBridge = { courierOrderId: "courier" };
    if (changed === "handed-off") f.tx.marketplaceStoreOrderLineFulfilment.count.mockResolvedValue(1);
    if (changed === "foreign-capture") f.capture.entries[0].account.code = "FOREIGN-ACCOUNT";
    if (changed === "fee-already-refunded") f.tx.marketplaceStoreOrderAdjustment.findMany.mockResolvedValue([{ deliveryFeeAmount: d("10.00") }]);
    if (changed === "wrong-fee-proof") f.adjustment.financialEvidence.unearnedDeliveryFee.settlementSnapshotReference = "foreign";
    await expect(f.check()).rejects.toMatchObject({ code: "REFUND_FUNDING_UNAVAILABLE" });
  });
});
