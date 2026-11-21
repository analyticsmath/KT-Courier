import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  attemptFindUnique: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptUpdate: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentUpdate: vi.fn(),
  paymentStatusHistoryCreate: vi.fn(),
  webhookFindFirst: vi.fn(),
  ledgerAccountFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  notificationUpsert: vi.fn(),
  applyWebhook: vi.fn(),
  postLedger: vi.fn(),
  activateCod: vi.fn(),
  confirmCourier: vi.fn(),
  openRecon: vi.fn(),
  resolveRecon: vi.fn(),
  recordAlert: vi.fn(),
  emitAlert: vi.fn(),
  consumeWallet: vi.fn(),
  settlePaidCancel: vi.fn(),
  upsertResolution: vi.fn(),
  revokeDispatch: vi.fn(),
  cancelCod: vi.fn(),
  transitionStatus: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.$transaction,
    paymentAttempt: { findUnique: mocks.attemptFindUnique, findFirst: mocks.attemptFindFirst },
    paymentWebhookEvent: { findFirst: mocks.webhookFindFirst },
  },
}));
vi.mock("@/lib/services/paystack-webhook-application.service", () => ({
  applyPaystackWebhookEvent: mocks.applyWebhook,
}));
vi.mock("@/lib/services/ledger-posting.service", () => ({
  postLedgerJournalWithinTransaction: mocks.postLedger,
}));
vi.mock("@/lib/services/cash-on-delivery.service", () => ({
  activateDepositCashOnDeliveryWithinTransaction: mocks.activateCod,
}));
vi.mock("@/lib/services/courier-order-confirmation.service", () => ({
  confirmVerifiedCourierOrderWithinTransaction: mocks.confirmCourier,
}));
vi.mock("@/lib/services/payment-reconciliation.service", () => ({
  openPaymentReconciliationCaseWithinTransaction: mocks.openRecon,
  resolvePaymentReconciliationCasesWithinTransaction: mocks.resolveRecon,
}));
vi.mock("@/lib/notifications/admin-alert-dispatch.service", () => ({
  recordAdminAlertIntentInTx: mocks.recordAlert,
  emitAdminAlertNonBlocking: mocks.emitAlert,
}));
vi.mock("@/lib/services/wallet-spending.service", () => ({
  consumeWalletSpendWithinTransaction: mocks.consumeWallet,
}));
vi.mock("@/lib/orders/parcel-cancellation-coordinator.service", () => ({
  settlePaidOrderCancellationInTx: mocks.settlePaidCancel,
  upsertParcelCancellationResolutionInTx: mocks.upsertResolution,
  revokePendingDispatchOffersInTx: mocks.revokeDispatch,
  cancelUncollectedCodObligationInTx: mocks.cancelCod,
  cancellationRequestHash: () => "mock-request-hash",
}));
vi.mock("@/lib/services/order-status.service", () => ({
  transitionOrderStatusInTx: mocks.transitionStatus,
}));

import {
  recoverPaystackAttemptViaVerify,
  recoverPendingPaystackPaymentForPaymentId,
} from "@/lib/services/paystack-verify-recovery.service";

describe("Paystack Verify API authoritative recovery (PAY-04..06)", () => {
  const txMock = {
    $queryRaw: mocks.$queryRaw,
    payment: { findUnique: mocks.paymentFindUnique, update: mocks.paymentUpdate },
    paymentAttempt: { findUnique: mocks.attemptFindUnique, update: mocks.attemptUpdate },
    ledgerAccount: { findMany: mocks.ledgerAccountFindMany },
    paymentStatusHistory: { create: mocks.paymentStatusHistoryCreate },
    order: { findUnique: mocks.orderFindUnique },
    notificationEventIntent: { upsert: mocks.notificationUpsert },
  };

  const basePayment = {
    id: "pay-1",
    publicReference: "KT-PAY-1",
    subjectType: "COURIER_ORDER",
    orderId: "ord-1",
    marketplaceCheckoutId: null,
    subscriptionInvoiceId: null,
    managedMarketingRequestId: null,
    userId: "user-1",
    status: "REQUIRES_ACTION",
    amount: new Prisma.Decimal("150.00"),
    currency: "ZAR",
    totalRefundedAmount: new Prisma.Decimal("0.00"),
    totalRefundReservedAmount: new Prisma.Decimal("0.00"),
    version: 1,
    latestAttemptNumber: 1,
    reconciliationStatus: "CLEAR",
    successLedgerJournalId: null,
    successWebhookEventId: null,
    metadata: {},
  };

  const baseAttempt = {
    id: "att-1",
    paymentId: "pay-1",
    publicReference: "att-ref-1",
    attemptNumber: 1,
    provider: "PAYSTACK",
    merchantReference: "kt_ref_1",
    providerReference: null,
    status: "REQUIRES_ACTION",
    amount: new Prisma.Decimal("150.00"),
    providerConfirmedAt: null,
    payment: basePayment,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.$queryRaw.mockResolvedValue([]);
    mocks.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock));
    mocks.webhookFindFirst.mockResolvedValue(null);
    mocks.attemptFindUnique.mockResolvedValue(baseAttempt);
    mocks.paymentFindUnique.mockResolvedValue(basePayment);
    mocks.ledgerAccountFindMany.mockResolvedValue([
      { id: "acc-cash", code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET" },
      { id: "acc-held", code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY" },
    ]);
    mocks.postLedger.mockResolvedValue({ id: "jrn-1", reference: "JRN-1" });
    mocks.orderFindUnique.mockResolvedValue({ id: "ord-1", orderNumber: "KT-001", status: "PENDING", storeId: null, customerId: "user-1", parcelCancellationResolution: null });
  });

  it("replays pending signed webhook event immediately before issuing raw Verify recovery", async () => {
    mocks.webhookFindFirst.mockResolvedValue({ id: "pwe-1" });
    mocks.applyWebhook.mockResolvedValue({ outcome: "APPLIED", eventPublicReference: "pwe_ref_1", ledgerJournalReference: "JRN-WH-1" });

    const res = await recoverPaystackAttemptViaVerify({
      attemptId: "att-1",
      trigger: "customer_status_poll",
    });

    expect(res.recovered).toBe(true);
    expect(res.outcome).toBe("APPLIED_WEBHOOK");
    expect(res.ledgerJournalReference).toBe("JRN-WH-1");
    expect(mocks.applyWebhook).toHaveBeenCalledWith({ webhookEventId: "pwe-1", clientOverride: undefined });
  });

  it("posts canonical receipt journal and confirms order when Paystack Verify proves exact ZAR success without forging webhook signature", async () => {
    const mockClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 999111,
        status: "success",
        reference: "kt_ref_1",
        amount: 15000,
        currency: "ZAR",
      }),
    };

    const res = await recoverPaystackAttemptViaVerify({
      attemptId: "att-1",
      trigger: "customer_status_poll",
      clientOverride: mockClient as never,
    });

    expect(res.recovered).toBe(true);
    expect(res.outcome).toBe("SETTLED_VIA_VERIFY");
    expect(res.ledgerJournalReference).toBe("JRN-1");
    expect(mocks.postLedger).toHaveBeenCalled();
    expect(mocks.activateCod).toHaveBeenCalled();
    expect(mocks.confirmCourier).toHaveBeenCalledWith(txMock, {
      subjectType: "COURIER_ORDER",
      orderId: "ord-1",
      publicReference: "KT-PAY-1",
    });
    expect(mocks.paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUCCEEDED",
          successLedgerJournalId: "jrn-1",
          metadata: expect.objectContaining({ verifiedVia: "PAYSTACK_VERIFY_API" }),
        }),
      }),
    );
  });

  it("opens reconciliation case and refuses confirmation when Paystack Verify reports an amount mismatch", async () => {
    const mockClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 999222,
        status: "success",
        reference: "kt_ref_1",
        amount: 14000,
        currency: "ZAR",
      }),
    };

    const res = await recoverPaystackAttemptViaVerify({
      attemptId: "att-1",
      trigger: "scan_payment_reconciliation",
      clientOverride: mockClient as never,
    });

    expect(res.recovered).toBe(false);
    expect(res.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(mocks.openRecon).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({ reason: "AMOUNT_MISMATCH", provider: "PAYSTACK" }),
    );
    expect(mocks.postLedger).not.toHaveBeenCalled();
    expect(mocks.confirmCourier).not.toHaveBeenCalled();
  });

  it("records FAILED when Paystack Verify reports failed or abandoned without touching confirmed orders", async () => {
    const mockClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 999333,
        status: "abandoned",
        reference: "kt_ref_1",
        amount: 15000,
        currency: "ZAR",
      }),
    };
    mocks.paymentStatusHistoryCreate.mockResolvedValue({ id: "psh-fail-1" });

    const res = await recoverPaystackAttemptViaVerify({
      attemptId: "att-1",
      trigger: "customer_status_poll",
      clientOverride: mockClient as never,
    });

    expect(res.recovered).toBe(false);
    expect(res.outcome).toBe("FAILED_VIA_VERIFY");
    expect(mocks.paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
    expect(mocks.postLedger).not.toHaveBeenCalled();
    expect(mocks.confirmCourier).not.toHaveBeenCalled();
  });

  it("reconciles late provider payment when parcel was cancelled without reviving cancelled order", async () => {
    // Order was cancelled (e.g. at 24h expiry deadline)
    mocks.orderFindUnique.mockResolvedValue({
      id: "ord-1",
      orderNumber: "KT-001",
      status: "CANCELLED",
      storeId: null,
      customerId: "user-1",
      parcelCancellationResolution: null,
    });
    mocks.settlePaidCancel.mockResolvedValue({
      walletOwnerType: "CUSTOMER",
      walletOwnerId: "user-1",
      walletRefundJournalId: "jrn-refund-1",
      paymentRefundId: "ref-1",
    });

    const mockClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 999444,
        status: "success",
        reference: "kt_ref_1",
        amount: 15000,
        currency: "ZAR",
      }),
    };

    const res = await recoverPaystackAttemptViaVerify({
      attemptId: "att-1",
      trigger: "customer_status_poll",
      clientOverride: mockClient as never,
    });

    expect(res.recovered).toBe(true);
    expect(res.outcome).toBe("SETTLED_VIA_VERIFY");
    // Receipt journal is recorded so money is never lost
    expect(mocks.postLedger).toHaveBeenCalled();
    // But cancelled courier order is NOT confirmed or revived!
    expect(mocks.confirmCourier).not.toHaveBeenCalled();
    // Instead, cancellation settlement and out-of-order reconciliation are executed
    expect(mocks.settlePaidCancel).toHaveBeenCalled();
    expect(mocks.upsertResolution).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        orderId: "ord-1",
        status: "COMPLETED_LATE_PAYMENT_REFUND_INITIATED",
        resolved: true,
      }),
    );
    expect(mocks.openRecon).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        paymentId: "pay-1",
        reason: "OUT_OF_ORDER_EVENT",
        provider: "PAYSTACK",
      }),
    );
  });

  it("consumes wallet split reservation and journals provider payment upon verify success", async () => {
    const splitPayment = {
      ...basePayment,
      amount: new Prisma.Decimal("100.00"),
      metadata: {
        walletAmount: "50.00",
        walletSplit: true,
        walletOwnerType: "CUSTOMER",
        walletOwnerId: "user-1",
      },
    };
    const splitAttempt = {
      ...baseAttempt,
      amount: new Prisma.Decimal("100.00"),
      payment: splitPayment,
    };

    mocks.attemptFindUnique.mockResolvedValue(splitAttempt);
    mocks.paymentFindUnique.mockResolvedValue(splitPayment);
    mocks.consumeWallet.mockResolvedValue({ amount: "50.00", journalId: "jrn-wallet-split-1" });

    const mockClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 999555,
        status: "success",
        reference: "kt_ref_1",
        amount: 10000,
        currency: "ZAR",
      }),
    };

    const res = await recoverPaystackAttemptViaVerify({
      attemptId: "att-1",
      trigger: "customer_status_poll",
      clientOverride: mockClient as never,
    });

    expect(res.recovered).toBe(true);
    expect(res.outcome).toBe("SETTLED_VIA_VERIFY");
    // Consumes reserved customer wallet portion
    expect(mocks.consumeWallet).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        amount: "50.00",
        fromReserved: true,
        owner: { ownerType: "CUSTOMER", ownerId: "user-1" },
      }),
    );
    // Provider portion confirmed in courier order
    expect(mocks.confirmCourier).toHaveBeenCalled();
  });

  it("rejects and flags reconciliation for currency mismatch (non-ZAR provider currency)", async () => {
    const mockClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 999666,
        status: "success",
        reference: "kt_ref_1",
        amount: 15000,
        currency: "USD", // Wrong currency!
      }),
    };

    const res = await recoverPaystackAttemptViaVerify({
      attemptId: "att-1",
      trigger: "customer_status_poll",
      clientOverride: mockClient as never,
    });

    expect(res.recovered).toBe(false);
    expect(res.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(mocks.openRecon).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        paymentId: "pay-1",
        provider: "PAYSTACK",
        reason: "AMOUNT_MISMATCH",
      }),
    );
    expect(mocks.confirmCourier).not.toHaveBeenCalled();
    expect(mocks.postLedger).not.toHaveBeenCalled();
  });

  it("returns ALREADY_SETTLED idempotently when attempt and payment are already settled", async () => {
    const settledAttempt = {
      ...baseAttempt,
      status: "SUCCEEDED",
    };
    const settledPayment = {
      ...basePayment,
      status: "SUCCEEDED",
      successLedgerJournalId: "jrn-already-done",
    };
    mocks.attemptFindUnique.mockResolvedValue({
      ...settledAttempt,
      payment: settledPayment,
    });

    const res = await recoverPaystackAttemptViaVerify({
      attemptId: "att-1",
      trigger: "customer_status_poll",
    });

    expect(res.recovered).toBe(true);
    expect(res.outcome).toBe("ALREADY_SETTLED");
    expect(mocks.postLedger).not.toHaveBeenCalled();
    expect(mocks.confirmCourier).not.toHaveBeenCalled();
  });

  it("recoverPendingPaystackPaymentForPaymentId finds latest unsettled attempt and triggers verify", async () => {
    mocks.attemptFindFirst.mockResolvedValue({ id: "att-1" });
    const mockClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 999777,
        status: "success",
        reference: "kt_ref_1",
        amount: 15000,
        currency: "ZAR",
      }),
    };

    const res = await recoverPendingPaystackPaymentForPaymentId("pay-1", {
      trigger: "customer_poll",
      clientOverride: mockClient as never,
    });

    expect(res.recovered).toBe(true);
    expect(res.outcome).toBe("SETTLED_VIA_VERIFY");
    expect(mocks.attemptFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentId: "pay-1",
          provider: "PAYSTACK",
          status: { in: ["REQUIRES_ACTION", "PROCESSING", "UNKNOWN"] },
        }),
      }),
    );
  });

  it("recoverPendingPaystackPaymentForPaymentId returns SKIPPED when no recoverable attempt exists", async () => {
    mocks.attemptFindFirst.mockResolvedValue(null);

    const res = await recoverPendingPaystackPaymentForPaymentId("pay-1", {
      trigger: "customer_poll",
    });

    expect(res.recovered).toBe(false);
    expect(res.outcome).toBe("SKIPPED");
    expect(res.paymentId).toBe("pay-1");
  });
});
