/* eslint-disable @typescript-eslint/no-explicit-any -- Transaction doubles expose only the exercised delegates. */
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUnstartedFullAdjustment } from "@/lib/store-orders/full-order-adjustment";
import { ExistingPhaseFinancialAdjustmentAuthority } from "@/lib/store-orders/financial-adjustment-composition";
import { assertCommittedMarketplaceAdjustmentFunding } from "@/lib/services/marketplace-adjustment-refund-authority";

const f = vi.hoisted(() => ({ tx: null as any, refund: vi.fn(), commission: vi.fn(), earning: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: (run: (tx: unknown) => unknown) => run(f.tx) } }));
vi.mock("@/lib/services/refund-request.service", () => ({ createMarketplaceRefundRequest: f.refund }));
vi.mock("@/lib/services/commission-reversal.service", () => ({ reverseCommissionInTransaction: f.commission }));
vi.mock("@/lib/services/store-earning-reversal.service", () => ({ adjustStoreEarningInTransaction: f.earning }));
const decimal = (value: string | number) => new Prisma.Decimal(value);
const input = { storeOrderId: "store-order", adjustmentType: "FULL_STORE_REJECTION" as const, actorUserId: "owner", reasonCode: "UNAVAILABLE", operationId: "cancel", requestHash: "hash", publicReference: "adjustment-ref" };
let order: any, snapshot: any, payment: any, adjustment: any, cod: any, job: any;
beforeEach(() => {
  vi.resetAllMocks();
  snapshot = { id: "snapshot", publicReference: "snapshot-ref", settlementVersion: "phase20-v1", status: "PENDING", sourceCheckoutId: "checkout", sourceCheckoutStoreGroupId: "group", sourcePaymentId: "payment", sourceCommercialFingerprint: "fingerprint", sellerBasis: decimal(90), deliveryFeeResidual: decimal(10), commissionAccrualReference: null, storeEarningReference: null };
  order = { id: "store-order", publicReference: "store-ref", checkoutStoreGroupId: "group", storeId: "store", store: { ownerUserId: "owner" }, groupTotal: decimal(100), deliveryFee: decimal(10), acceptanceStatus: "REVIEWING", preparationStatus: "NOT_STARTED", deliveryBridge: null, marketplaceOrder: { id: "marketplace", checkoutId: "checkout", paymentId: "payment", customerUserId: "customer", grandTotal: decimal(100), digitalRequired: decimal(20), cashRequired: decimal(80), payment: { publicReference: "payment-ref" } }, checkoutStoreGroup: { id: "group", checkoutId: "checkout", fulfilmentMode: "COURIER_DELIVERY", paymentPlan: { version: "marketplace-payment-v1", mode: "DEPOSIT_PLUS_COD", authoritativeTotal: "100.00", digitalRequired: "20.00", cashRequired: "80.00", policyId: "policy", policyVersion: 1, policyEvidence: {} } }, settlementSnapshots: [snapshot], lines: [{ id: "line", checkoutLineSnapshotId: "source", offerReference: "offer", quantity: 1, fulfilment: { status: "ORDERED", resolvedFulfilmentQuantity: 0, handedOffQuantity: 0 }, issues: [], financialAllocations: [] }] };
  payment = { id: "payment", publicReference: "payment-ref", subjectType: "MARKETPLACE_CHECKOUT", marketplaceCheckoutId: "checkout", marketplaceOrderId: "marketplace", userId: "customer", status: "SUCCEEDED", currency: "ZAR", reconciliationStatus: "CLEAR", amount: decimal(20), successfulAttempt: { status: "SUCCEEDED" }, successWebhookEvent: { processingStatus: "APPLIED", signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true }, successLedgerJournal: { id: "capture", type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", metadata: { paymentReference: "payment-ref" }, totalDebits: decimal(20), totalCredits: decimal(20), entries: [{ direction: "DEBIT", amount: decimal(20), account: { code: "CASH" } }, { direction: "CREDIT", amount: decimal(20), account: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" } }] } };
  job = { status: "PENDING", operationId: "finalize:settlement:store-order", lastSafeError: null };
  cod = null; adjustment = null;
  const level = { id: "level", inventoryItemId: "item", locationId: "location", onHand: 9, inventoryItem: { publicReference: "item-ref", offer: { publicReference: "offer", storeId: "store" } } };
  f.tx = {
    $queryRaw: vi.fn(async () => [{ id: "store-order" }]),
    marketplaceStoreOrder: { findUniqueOrThrow: vi.fn(async () => order), count: vi.fn(async () => 1) },
    marketplaceStoreOrderLineFulfilment: { count: vi.fn(async () => 0) },
    marketplaceStoreOrderAdjustment: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => adjustment), count: vi.fn(async () => 0), create: vi.fn(async ({ data }: any) => adjustment = { ...data, id: "adjustment", refundAmount: decimal(data.refundAmount), deliveryFeeAmount: decimal(data.deliveryFeeAmount), allocations: [], storeOrder: order }), update: vi.fn(async ({ data }: any) => Object.assign(adjustment, data)) },
    marketplaceStoreOrderIssue: { updateMany: vi.fn() },
    marketplaceStoreSettlementJob: { findFirstOrThrow: vi.fn(async () => job), findFirst: vi.fn(async () => job), updateMany: vi.fn(async ({ data }: any) => { Object.assign(job, data); return { count: 1 }; }) },
    payment: { findUnique: vi.fn(async () => payment) },
    cashOnDelivery: { findMany: vi.fn(async () => cod ? [cod] : []), findUniqueOrThrow: vi.fn(async () => cod), update: vi.fn(async ({ data }: any) => Object.assign(cod, data)) },
    marketplaceInventoryReservation: { findFirstOrThrow: vi.fn(async () => ({ items: [{ quantity: 1, inventoryItemReference: "item-ref", locationReference: "location", inventoryLevel: level }] })) },
    marketplaceCheckoutLineSnapshot: { findMany: vi.fn(async () => [{ id: "source", offerReference: "offer", quantity: 1, inventoryItemId: "item", inventoryLocationId: "location" }]) },
    catalogInventoryMovement: { findUnique: vi.fn(async () => ({ type: "SALE_COMMITMENT", locationId: "location", quantityDelta: -1 })), create: vi.fn(async () => ({ publicReference: "restock" })) },
    marketplaceStoreOrderSubstitutionReservation: { findMany: vi.fn(async () => []) },
    catalogInventoryLevel: { findUniqueOrThrow: vi.fn(async () => level), update: vi.fn(async () => ({ ...level, onHand: 10 })) },
  };
  f.refund.mockResolvedValue({ publicReference: "refund-ref" });
});
async function createAndStage() {
  await createUnstartedFullAdjustment(f.tx as Prisma.TransactionClient, input);
  order.preparationStatus = "ABORTED"; order.acceptanceStatus = "REJECTED"; adjustment.status = "APPLYING";
}
async function compose() {
  return new ExistingPhaseFinancialAdjustmentAuthority().applyExactAdjustment({ adjustmentReference: "adjustment-ref", storeOrderReference: "store-ref", operationId: "apply", frozenEvidence: {} });
}
const funding = { adjustmentReference: "adjustment-ref", paymentId: "payment", customerUserId: "customer", amount: "20.00", operationId: "apply:refund" };
function cash() { return { id: "cash", orderId: "courier", paymentId: "payment", status: "READY_FOR_COLLECTION", policyMode: "DEPOSIT_PLUS_COD", authoritativePayable: decimal(100), digitalRequired: decimal(20), digitalPaid: decimal(20), cashObligation: decimal(80), cashCollected: decimal(0), cashReconciled: decimal(0) }; }

describe("unstarted marketplace COD cancellation", () => {
  it.each(["FULL_STORE_REJECTION", "CUSTOMER_CANCELLATION"] as const)("%s refunds the actual deposit, restores inventory, and closes unaccrued settlement", async adjustmentType => {
    await createUnstartedFullAdjustment(f.tx, { ...input, adjustmentType });
    expect(adjustment.refundAmount.toFixed(2)).toBe("20.00");
    expect(adjustment.deliveryFeeAmount.toFixed(2)).toBe("0.00");
    expect(adjustment.allocations).toEqual([]);
    expect(f.tx.catalogInventoryLevel.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ onHand: { increment: 1 }, available: { increment: 1 } }) }));
    expect(job).toMatchObject({ status: "COMPLETED", lastSafeError: "UNSTARTED_COD_CANCELLED" });
    expect(snapshot.status).toBe("PENDING");
    order.preparationStatus = "ABORTED"; adjustment.status = "APPLYING";
    await expect(compose()).resolves.toMatchObject({ refundReference: "refund-ref", commissionReversalReferences: [], financialStatus: "REFUND_RESERVED" });
    expect(f.refund).toHaveBeenCalledWith(expect.objectContaining({ amount: "20.00", sourceAdjustmentReference: "adjustment-ref", method: "ORIGINAL_PAYMENT_METHOD" }), {});
    expect(f.commission).not.toHaveBeenCalled(); expect(f.earning).not.toHaveBeenCalled();
    await expect(assertCommittedMarketplaceAdjustmentFunding(f.tx, funding)).resolves.toBeUndefined();
  });
  it("cancels an existing uncollected cash obligation under courier then cash locks", async () => {
    cod = cash(); await createAndStage();
    expect(cod.status).toBe("CANCELLED");
    expect(f.tx.cashOnDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ events: { create: expect.objectContaining({ eventType: "CANCELLED", safeEvidence: { adjustmentReference: "adjustment-ref", cashCancelled: "80.00" } }) } }) }));
    const locks = f.tx.$queryRaw.mock.calls.map(([sql]: any[]) => sql.strings.join("?"));
    expect(locks.findIndex((sql: string) => sql.includes('FROM "Order"'))).toBeLessThan(locks.findIndex((sql: string) => sql.includes('FROM "CashOnDelivery"')));
  });
  it.each(["COLLECTED", "RECONCILED", "UNDER_RECONCILIATION"])("blocks a %s cash obligation before inventory restoration", async status => {
    cod = { ...cash(), status }; await expect(createAndStage()).rejects.toMatchObject({ code: "REFUND_FUNDING_UNAVAILABLE" });
    expect(f.tx.catalogInventoryLevel.update).not.toHaveBeenCalled(); expect(f.tx.marketplaceStoreOrderAdjustment.create).not.toHaveBeenCalled();
  });
  it("blocks recorded collection even when the status still says ready", async () => { cod = { ...cash(), cashCollected: decimal(80) }; await expect(createAndStage()).rejects.toMatchObject({ code: "REFUND_FUNDING_UNAVAILABLE" }); });
  it.each(["capture-missing", "capture-inflated", "foreign-receipt", "unverified", "multiple-stores", "already-accrued", "no-held-credit", "wrong-split", "missing-cash-split", "pickup"])("blocks %s source evidence", async failure => {
    if (failure === "capture-missing") payment.successLedgerJournal = null;
    if (failure === "capture-inflated") payment.amount = decimal(100);
    if (failure === "foreign-receipt") payment.successLedgerJournal.metadata.paymentReference = "foreign";
    if (failure === "unverified") payment.successWebhookEvent.amountVerified = false;
    if (failure === "multiple-stores") f.tx.marketplaceStoreOrder.count.mockResolvedValue(2);
    if (failure === "already-accrued") snapshot.commissionAccrualReference = "accrual";
    if (failure === "no-held-credit") payment.successLedgerJournal.entries[1].account.code = "OTHER";
    if (failure === "wrong-split") order.marketplaceOrder.cashRequired = decimal(70);
    if (failure === "missing-cash-split") order.marketplaceOrder.cashRequired = decimal(0);
    if (failure === "pickup") order.checkoutStoreGroup.fulfilmentMode = "CUSTOMER_PICKUP";
    await expect(createAndStage()).rejects.toMatchObject({ code: "REFUND_FUNDING_UNAVAILABLE" });
    expect(f.tx.catalogInventoryLevel.update).not.toHaveBeenCalled();
  });
  it("does not cancel a settlement job already claimed for processing", async () => {
    f.tx.marketplaceStoreSettlementJob.updateMany.mockResolvedValue({ count: 0 });
    await expect(createAndStage()).rejects.toMatchObject({ code: "STORE_ORDER_FINANCIAL_ALLOCATION_INVALID" });
    expect(f.tx.marketplaceStoreOrderAdjustment.create).not.toHaveBeenCalled();
  });
  it("rejects any second non-rejected adjustment", async () => { f.tx.marketplaceStoreOrderAdjustment.findMany.mockResolvedValue([{ deliveryFeeAmount: decimal(0), allocations: [] }]); await expect(createAndStage()).rejects.toMatchObject({ code: "STORE_ORDER_FINANCIAL_ALLOCATION_INVALID" }); });
  it.each(["total-refund", "foreign-capture", "fake-reversal", "open-job", "other-adjustment"])("denies %s committed funding", async failure => {
    await createAndStage(); await compose();
    if (failure === "total-refund") adjustment.refundAmount = decimal(100);
    if (failure === "foreign-capture") adjustment.financialEvidence.phase21CommittedReversals.captureJournalId = "foreign";
    if (failure === "fake-reversal") adjustment.financialEvidence.phase21CommittedReversals.commissionReversalReferences = ["fake"];
    if (failure === "open-job") job.status = "PENDING";
    if (failure === "other-adjustment") f.tx.marketplaceStoreOrderAdjustment.count.mockResolvedValue(1);
    await expect(assertCommittedMarketplaceAdjustmentFunding(f.tx, funding)).rejects.toMatchObject({ code: "REFUND_FUNDING_UNAVAILABLE" });
  });
  it("replays its committed deposit refund without producing reversals", async () => { await createAndStage(); await compose(); await compose(); expect(f.commission).not.toHaveBeenCalled(); expect(f.earning).not.toHaveBeenCalled(); expect(f.tx.marketplaceStoreOrderAdjustment.update).toHaveBeenCalledOnce(); });
});
