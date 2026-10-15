import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { settlement } from "./fixtures";
const mocks = vi.hoisted(() => ({
  db: { $transaction: vi.fn(), $queryRaw: vi.fn(), driverEarning: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() }, orderAssignment: { findUnique: vi.fn() }, payment: { findUnique: vi.fn() }, marketplaceStoreOrderDeliveryBridge: { findUnique: vi.fn() }, ledgerAccount: { findFirst: vi.fn() }, ledgerJournal: { findMany: vi.fn() } },
  ensure: vi.fn(), accounts: vi.fn(), post: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/services/driver-earning-account.service", () => ({ ensureDriverEarningPayableAccount: mocks.ensure, resolveDriverEarningAccountsWithinTransaction: mocks.accounts }));
vi.mock("@/lib/services/ledger-posting.service", () => ({ postLedgerJournalWithinTransaction: mocks.post }));
import { accrueDriverEarning } from "@/lib/services/driver-earning-accrual.service";
const d = (v: string) => new Prisma.Decimal(v);
const snapshot = () => settlement({ driverSettlementBasisAmount: "20.00", attributedCommissionAmount: "0.00", netDriverEarningAmount: "20.00", commissionCharges: [] });
const plan = { version: "marketplace-payment-v1", mode: "DEPOSIT_PLUS_COD", authoritativeTotal: "200.00", digitalRequired: "100.00", cashRequired: "100.00", policyId: "policy", policyVersion: 1, policyEvidence: {} };
const payment = () => ({ id: "payment-17", publicReference: "PAY-0017", subjectType: "MARKETPLACE_CHECKOUT", orderId: null, marketplaceCheckoutId: "checkout-1", marketplaceOrderId: "mpo-1", status: "SUCCEEDED", currency: "ZAR", amount: d("100.00"), totalRefundedAmount: d("0.00"), totalRefundReservedAmount: d("0.00"), reconciliationStatus: "CLEAR", successfulAttempt: { status: "SUCCEEDED" }, successWebhookEvent: { processingStatus: "APPLIED", signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true }, successLedgerJournal: { type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", totalDebits: d("100.00"), totalCredits: d("100.00"), entries: [{ direction: "CREDIT", amount: d("100.00"), account: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" } }] } });
const bridge = () => ({ courierOrder: { orderNumber: "KT-0017", pricingQuoteId: "quote-1", cashOnDelivery: { publicReference: "COD-1", status: "RECONCILED", paymentId: "payment-17", collectorDriverId: "driver-17", digitalRequired: d("100.00"), digitalPaid: d("100.00"), cashObligation: d("100.00"), cashCollected: d("100.00"), cashReconciled: d("100.00"), remittanceDiscrepancy: d("0.00"), collectionJournalId: "collect-1", reconciliationJournalId: "bank-1" } }, storeOrder: { checkoutStoreGroup: { deliveryQuoteReference: "quote-1", deliveryFee: d("20.00"), paymentPlan: plan }, marketplaceOrder: { id: "mpo-1", checkoutId: "checkout-1", paymentId: "payment-17", digitalRequired: d("100.00"), cashRequired: d("100.00"), grandTotal: d("200.00") } } });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation(work => work(mocks.db)); mocks.db.$queryRaw.mockResolvedValue([{ id: "locked" }]);
  mocks.db.driverEarning.findUnique.mockResolvedValue(null); mocks.db.driverEarning.findFirst.mockResolvedValue(null);
  mocks.ensure.mockResolvedValue({ driver: { publicReference: "DRV-1017" }, wallet: { id: "wallet-17" }, account: { id: "payable-1" } }); mocks.accounts.mockResolvedValue({ payable: { id: "payable-1" } }); mocks.post.mockResolvedValue({ id: "earning-journal-1", reference: "EARN-1" });
  mocks.db.orderAssignment.findUnique.mockResolvedValue({ id: "assignment-17", version: 7, driverProfileId: "driver-17", orderId: "order-17", status: "COMPLETED", completedAt: new Date("2026-07-17T08:00:00.000Z"), proofOfDelivery: { assignmentId: "assignment-17", driverProfileId: "driver-17", orderId: "order-17", deliveredAt: new Date("2026-07-17T08:00:00.000Z") }, operationalEvents: [{ eventType: "DELIVERY_COMPLETED" }], events: [{ eventType: "ASSIGNMENT_COMPLETED" }] });
  mocks.db.payment.findUnique.mockResolvedValue(payment()); mocks.db.marketplaceStoreOrderDeliveryBridge.findUnique.mockResolvedValue(bridge()); mocks.db.ledgerAccount.findFirst.mockResolvedValue({ id: "held-1", currentBalance: d("1000.00") });
  const entry = (code: string, direction: string) => ({ account: { code }, direction, amount: d("100.00") }); const common = { type: "GENERAL", currency: "ZAR", totalDebits: d("100.00"), totalCredits: d("100.00") };
  mocks.db.ledgerJournal.findMany.mockResolvedValue([{ ...common, id: "collect-1", sourceReference: "cod:COD-1:collection", entries: [entry("DRIVER-COD-CASH-DRIVER17","DEBIT"),entry("PLATFORM-CUSTOMER-FUNDS-HELD-ZAR","CREDIT")] }, { ...common, id: "bank-1", sourceReference: "cod:COD-1:reconciliation", entries: [entry("PLATFORM-CASH-CLEARING-ZAR","DEBIT"),entry("DRIVER-COD-CASH-DRIVER17","CREDIT")] }]);
  mocks.db.driverEarning.create.mockImplementation(async ({ data }) => ({ ...data, accrualLedgerJournal: { reference: "EARN-1" }, releaseLedgerJournal: null, reversalLedgerJournal: null }));
});
const accrue = () => accrueDriverEarning({ operationId: "marketplace-driver-earning-1", snapshot: snapshot() });
describe("canonical marketplace courier driver funding", () => {
  it("accrues the frozen delivery fee from a reconciled COD bridge without binding the marketplace payment to a courier", async () => { await expect(accrue()).resolves.toMatchObject({ amount: "20.00", status: "ACCRUED" }); expect(mocks.post).toHaveBeenCalledOnce(); expect(mocks.db.driverEarning.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentId: "payment-17", orderId: "order-17" }) })); });
  it("retains ordinary fully digital marketplace driver accrual", async () => {
    const b = bridge(); b.storeOrder.marketplaceOrder.cashRequired = d("0.00"); b.storeOrder.marketplaceOrder.grandTotal = d("100.00"); mocks.db.marketplaceStoreOrderDeliveryBridge.findUnique.mockResolvedValue(b);
    await expect(accrue()).resolves.toMatchObject({ amount: "20.00" }); expect(mocks.db.ledgerJournal.findMany).not.toHaveBeenCalled();
  });
  it.each(["READY_FOR_COLLECTION","COLLECTED","UNDER_RECONCILIATION"])("withholds earning while COD is %s even when global held balance is sufficient", async status => { const b = bridge(); b.courierOrder.cashOnDelivery.status = status; mocks.db.marketplaceStoreOrderDeliveryBridge.findUnique.mockResolvedValue(b); await expect(accrue()).rejects.toMatchObject({ code: "DRIVER_EARNING_PAYMENT_INVALID" }); expect(mocks.post).not.toHaveBeenCalled(); });
  it("rejects another checkout's payment even when deposit amount matches", async () => { const paid = payment(); paid.marketplaceCheckoutId = "another-checkout"; mocks.db.payment.findUnique.mockResolvedValue(paid); await expect(accrue()).rejects.toMatchObject({ code: "DRIVER_EARNING_PAYMENT_INVALID" }); expect(mocks.post).not.toHaveBeenCalled(); });
  it("rejects fee inflation beyond the child's frozen delivery allocation", async () => { const b = bridge(); b.storeOrder.checkoutStoreGroup.deliveryFee = d("19.99"); mocks.db.marketplaceStoreOrderDeliveryBridge.findUnique.mockResolvedValue(b); await expect(accrue()).rejects.toMatchObject({ code: "DRIVER_EARNING_PAYMENT_INVALID" }); expect(mocks.post).not.toHaveBeenCalled(); });
  it("rejects unrelated bank receipt journal", async () => { mocks.db.ledgerJournal.findMany.mockResolvedValue([]); await expect(accrue()).rejects.toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" }); expect(mocks.post).not.toHaveBeenCalled(); });
});
