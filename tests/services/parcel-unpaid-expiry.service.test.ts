import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatus } from "@/types/db";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  orderFindUnique: vi.fn(),
  paymentAttemptUpdateMany: vi.fn(),
  paymentUpdate: vi.fn(),
  paymentStatusHistoryCreate: vi.fn(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  recover: vi.fn(),
  readiness: vi.fn(),
  transition: vi.fn(),
  revokeOffers: vi.fn(),
  cancelCod: vi.fn(),
  upsertResolution: vi.fn(),
  releaseWallet: vi.fn(),
  unpaidNotif: vi.fn(),
  recordAlert: vi.fn(),
  emitAlert: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: { findMany: mocks.findMany },
    $transaction: mocks.$transaction,
  },
}));
vi.mock("@/lib/services/paystack-verify-recovery.service", () => ({
  recoverPendingPaystackPaymentForPaymentId: mocks.recover,
}));
vi.mock("@/lib/services/courier-payment-readiness.service", () => ({
  getCourierPaymentReadiness: mocks.readiness,
}));
vi.mock("@/lib/services/order-status.service", () => ({
  transitionOrderStatusInTx: mocks.transition,
}));
vi.mock("@/lib/orders/parcel-cancellation-coordinator.service", async (orig) => ({
  ...(await orig()),
  revokePendingDispatchOffersInTx: mocks.revokeOffers,
  cancelUncollectedCodObligationInTx: mocks.cancelCod,
  upsertParcelCancellationResolutionInTx: mocks.upsertResolution,
}));
vi.mock("@/lib/services/wallet-spending.service", () => ({
  releaseParcelOrderWalletReservationWithinTransaction: mocks.releaseWallet,
}));
vi.mock("@/lib/services/notification-events.service", () => ({
  appendCourierUnpaidCancelledInTx: mocks.unpaidNotif,
}));
vi.mock("@/lib/notifications/admin-alert-dispatch.service", () => ({
  recordAdminAlertIntentInTx: mocks.recordAlert,
  emitAdminAlertNonBlocking: mocks.emitAlert,
}));

import {
  expireUnpaidCourierOrdersBatch,
  UNPAID_PARCEL_EXPIRY_ELIGIBLE_WHERE,
} from "@/lib/services/parcel-unpaid-expiry.service";

describe("24-hour unpaid parcel expiry processor (EXP-01..07)", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");
  const pastDue = new Date("2026-11-18T11:59:00.000Z");
  let txMock: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    txMock = {
      $queryRaw: mocks.$queryRaw.mockResolvedValue([]),
      order: { findUnique: mocks.orderFindUnique },
      paymentAttempt: { updateMany: mocks.paymentAttemptUpdateMany.mockResolvedValue({ count: 0 }) },
      payment: { update: mocks.paymentUpdate.mockResolvedValue({}) },
      paymentStatusHistory: { create: mocks.paymentStatusHistoryCreate.mockResolvedValue({}) },
    };
    mocks.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock));
    mocks.recover.mockResolvedValue({ recovered: false, outcome: "SKIPPED" });
    mocks.readiness.mockResolvedValue({
      status: "PAYMENT_REQUIRED",
      dispatchEligible: false,
      paymentReference: null,
      amount: null,
      cashDue: null,
      reasonCode: "PAYMENT_PENDING",
      reasonMessage: "Unpaid",
    });
    mocks.releaseWallet.mockResolvedValue({ released: true, journalId: "wal-rel-1", amount: "20.00", replayed: false });
  });

  it("queries strictly PENDING overdue non-bridge non-FULL_COD orders (never null historic deadlines)", () => {
    const where = UNPAID_PARCEL_EXPIRY_ELIGIBLE_WHERE(now);
    expect(where).toMatchObject({
      status: "PENDING",
      paymentDueAt: { lte: now },
      marketplaceStoreOrderBridge: { is: null },
      custodyEstablishedAt: null,
      OR: [
        { cashOnDelivery: { is: null } },
        { cashOnDelivery: { policyMode: { not: "FULL_COD" } } },
      ],
    });
  });

  it("supports DRY_RUN without mutating any order, payment, or notification row", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "o-1", orderNumber: "KT-EXP-1", paymentDueAt: pastDue, payments: [] },
    ]);

    const res = await expireUnpaidCourierOrdersBatch({ mode: "DRY_RUN", batchSize: 10, now });
    expect(res.itemsExamined).toBe(1);
    expect(res.itemsCompleted).toBe(0);
    expect(res.itemsSkipped).toBe(1);
    expect(mocks.$transaction).not.toHaveBeenCalled();
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("recovers verified-at-Paystack overdue attempt instead of cancelling it (EXP-06)", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "o-paid",
        orderNumber: "KT-PAID-1",
        paymentDueAt: pastDue,
        payments: [{ id: "pay-1", status: "REQUIRES_ACTION", reconciliationStatus: "CLEAR", attempts: [{ id: "att-1", status: "REQUIRES_ACTION" }] }],
      },
    ]);
    mocks.recover.mockResolvedValue({ recovered: true, outcome: "SETTLED_VIA_VERIFY" });

    const res = await expireUnpaidCourierOrdersBatch({ mode: "APPLY", batchSize: 10, now });
    expect(res.itemsCompleted).toBe(0);
    expect(res.itemsSkipped).toBe(1);
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(mocks.upsertResolution).not.toHaveBeenCalled();
  });

  it("cancels genuinely unpaid overdue booking, releases split wallet & COD, and writes notifications", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "o-unpaid",
        orderNumber: "KT-UNPAID-1",
        paymentDueAt: pastDue,
        payments: [{ id: "pay-u1", status: "CREATED", reconciliationStatus: "CLEAR", attempts: [] }],
      },
    ]);
    mocks.orderFindUnique.mockResolvedValue({
      id: "o-unpaid",
      orderNumber: "KT-UNPAID-1",
      customerId: "cust-1",
      status: OrderStatus.PENDING,
      paymentDueAt: pastDue,
      custodyEstablishedAt: null,
      marketplaceStoreOrderBridge: null,
      parcelCancellationResolution: null,
      assignments: [],
      cashOnDelivery: { id: "cod-1", policyMode: "DEPOSIT_PLUS_COD" },
      payments: [
        {
          id: "pay-u1",
          status: "CREATED",
          reconciliationStatus: "CLEAR",
          successLedgerJournalId: null,
          metadata: { walletSplit: true, walletAmount: "25.00" },
          attempts: [],
        },
      ],
    });

    const res = await expireUnpaidCourierOrdersBatch({ mode: "APPLY", batchSize: 10, now });
    expect(res.itemsCompleted).toBe(1);
    expect(res.expiredOrderIds).toEqual(["o-unpaid"]);
    expect(mocks.revokeOffers).toHaveBeenCalled();
    expect(mocks.cancelCod).toHaveBeenCalled();
    expect(mocks.releaseWallet).toHaveBeenCalled();
    expect(mocks.transition).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        orderId: "o-unpaid",
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.CANCELLED,
        source: "expire_unpaid_courier_orders",
      }),
    );
    expect(mocks.upsertResolution).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        orderId: "o-unpaid",
        status: "COMPLETED_UNPAID_CANCELLED",
        walletRefundJournalId: "wal-rel-1",
      }),
    );
    expect(mocks.unpaidNotif).toHaveBeenCalled();
    expect(mocks.recordAlert).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({ eventType: "PARCEL_ORDER_UNPAID_EXPIRED" }),
    );
  });

  it("holds reconciliation-required orders safely without cancelling (EXP-07)", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "o-recon",
        orderNumber: "KT-RECON-1",
        paymentDueAt: pastDue,
        payments: [{ id: "pay-r1", status: "PROCESSING", reconciliationStatus: "REQUIRED", attempts: [] }],
      },
    ]);
    mocks.recover.mockResolvedValue({ recovered: false, outcome: "RECONCILIATION_REQUIRED" });

    const res = await expireUnpaidCourierOrdersBatch({ mode: "APPLY", batchSize: 10, now });
    expect(res.itemsReconciled).toBe(1);
    expect(res.itemsCompleted).toBe(0);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("never expires FULL_COD or ambiguous ongoing Paystack PROCESSING attempts without Paystack fail verdict", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "o-proc", orderNumber: "KT-PROC-1", paymentDueAt: pastDue, payments: [{ id: "pay-p1", status: "PROCESSING", reconciliationStatus: "CLEAR", attempts: [{ id: "att-p1", status: "PROCESSING" }] }] },
    ]);
    mocks.orderFindUnique.mockResolvedValue({
      id: "o-proc",
      orderNumber: "KT-PROC-1",
      customerId: "cust-1",
      status: OrderStatus.PENDING,
      paymentDueAt: pastDue,
      custodyEstablishedAt: null,
      marketplaceStoreOrderBridge: null,
      parcelCancellationResolution: null,
      assignments: [],
      cashOnDelivery: null,
      payments: [
        {
          id: "pay-p1",
          status: "PROCESSING",
          reconciliationStatus: "CLEAR",
          successLedgerJournalId: null,
          metadata: null,
          attempts: [{ id: "att-p1", status: "PROCESSING", expiresAt: null }],
        },
      ],
    });

    const res = await expireUnpaidCourierOrdersBatch({ mode: "APPLY", batchSize: 10, now });
    expect(res.itemsRetried).toBe(1);
    expect(res.itemsCompleted).toBe(0);
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
