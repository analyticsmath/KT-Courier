import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const mocks = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  attemptFindMany: vi.fn(),
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
  reconCaseFindUnique: vi.fn(),
  reconCaseFindMany: vi.fn(),
  reconCaseUpdate: vi.fn(),
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

const dbMock = vi.hoisted(() => ({
  $transaction: mocks.$transaction,
  paymentAttempt: {
    findMany: mocks.attemptFindMany,
    findUnique: mocks.attemptFindUnique,
    findFirst: mocks.attemptFindFirst,
  },
  paymentWebhookEvent: { findFirst: mocks.webhookFindFirst },
  paymentReconciliationCase: {
    findUnique: mocks.reconCaseFindUnique,
    findMany: mocks.reconCaseFindMany,
    update: mocks.reconCaseUpdate,
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: dbMock }));
vi.mock("@/lib/operations/phase5-repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/operations/phase5-repository")>()),
  phase5Repository: dbMock,
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
  reconcileStalePaystackAttempts,
  parseStalePaystackReconciliationArgs,
} from "@/lib/services/paystack-verify-recovery.service";
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";
import { domainAdapters } from "@/lib/reconciliation/adapters/domain-adapters";
import { executeUnifiedRecoveryCommand } from "@/lib/reconciliation/service";
import { PaymentError } from "@/lib/payments/errors";

describe("Paystack stale attempt reconciliation path & governance", () => {
  const staleAt = new Date("2026-11-22T06:00:00Z");
  const cutoff = new Date("2026-11-22T08:00:00Z");

  const makeAttempt = (overrides: Record<string, unknown> = {}) => {
    const payment = {
      id: "pay-179",
      publicReference: "pay_kt_136446",
      subjectType: "COURIER_ORDER",
      orderId: "ord-179",
      marketplaceCheckoutId: null,
      subscriptionInvoiceId: null,
      managedMarketingRequestId: null,
      userId: "usr-1",
      status: "PROCESSING",
      amount: new Prisma.Decimal("179.00"),
      currency: "ZAR",
      totalRefundedAmount: new Prisma.Decimal("0.00"),
      totalRefundReservedAmount: new Prisma.Decimal("0.00"),
      version: 2,
      latestAttemptNumber: 1,
      reconciliationStatus: "CLEAR",
      successLedgerJournalId: null,
      successWebhookEventId: null,
      metadata: {},
      order: { orderNumber: "KT-2026-136446" },
      ...(overrides.payment as Record<string, unknown> | undefined),
    };
    return {
      id: "att-179",
      paymentId: payment.id,
      publicReference: "pat_179",
      attemptNumber: 1,
      provider: "PAYSTACK",
      providerEnvironment: "PRODUCTION",
      merchantReference: "kt-payment-pay_kt_136446-attempt-1",
      providerReference: null,
      status: "UNKNOWN",
      failureCategory: "MALFORMED_RESPONSE",
      failureCode: "PAYMENT_PROVIDER_RESPONSE_INVALID",
      amount: new Prisma.Decimal("179.00"),
      currency: "ZAR",
      providerConfirmedAt: null,
      updatedAt: staleAt,
      ...overrides,
      payment,
    };
  };

  const txMock = {
    $queryRaw: mocks.$queryRaw,
    payment: { findUnique: mocks.paymentFindUnique, update: mocks.paymentUpdate },
    paymentAttempt: { findUnique: mocks.attemptFindUnique, update: mocks.attemptUpdate },
    ledgerAccount: { findMany: mocks.ledgerAccountFindMany },
    paymentStatusHistory: { create: mocks.paymentStatusHistoryCreate },
    order: { findUnique: mocks.orderFindUnique },
    notificationEventIntent: { upsert: mocks.notificationUpsert },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.$queryRaw.mockResolvedValue([]);
    mocks.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(txMock));
    mocks.webhookFindFirst.mockResolvedValue(null);
    mocks.ledgerAccountFindMany.mockResolvedValue([
      { id: "acc-cash", code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET" },
      { id: "acc-held", code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY" },
    ]);
    mocks.postLedger.mockResolvedValue({ id: "jrn-179", reference: "JRN-179" });
    mocks.orderFindUnique.mockResolvedValue({
      id: "ord-179",
      orderNumber: "KT-2026-136446",
      status: "PENDING",
      storeId: null,
      customerId: "usr-1",
      parcelCancellationResolution: null,
    });
  });

  it("defaults CLI options strictly to DRY_RUN and parses filter arguments safely", () => {
    expect(parseStalePaystackReconciliationArgs([])).toMatchObject({
      mode: "DRY_RUN",
      staleMinutes: 30,
      limit: 25,
      orderNumbers: [],
    });

    expect(
      parseStalePaystackReconciliationArgs([
        "--apply",
        "--order",
        "KT-2026-136446",
        "--order",
        "KT-2026-181078",
        "--merchant-ref",
        "ref_1",
        "--stale-minutes",
        "45",
        "--limit",
        "10",
      ]),
    ).toEqual({
      mode: "APPLY",
      orderNumbers: ["KT-2026-136446", "KT-2026-181078"],
      merchantReferences: ["ref_1"],
      paymentPublicReferences: [],
      staleMinutes: 45,
      limit: 10,
    });
  });

  it("supports DRY_RUN without calling Paystack or mutating the database", async () => {
    const staleUnknown = makeAttempt();
    mocks.attemptFindMany.mockResolvedValue([staleUnknown]);
    const mockClient = { verifyTransaction: vi.fn() };

    const report = await reconcileStalePaystackAttempts({
      mode: "DRY_RUN",
      staleBefore: cutoff,
      orderNumbers: ["KT-2026-136446"],
      clientOverride: mockClient as never,
    });

    expect(report.mode).toBe("DRY_RUN");
    expect(report.examined).toBe(1);
    expect(report.items).toEqual([
      expect.objectContaining({
        orderNumber: "KT-2026-136446",
        paymentPublicReference: "pay_kt_136446",
        attemptPublicReference: "pat_179",
        merchantReference: "kt-payment-pay_kt_136446-attempt-1",
        attemptStatus: "UNKNOWN",
        amountZar: "179.00",
        currency: "ZAR",
        outcome: "DRY_RUN",
      }),
    ]);
    expect(mockClient.verifyTransaction).not.toHaveBeenCalled();
    expect(mocks.$transaction).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain("usr-1");
  });

  it("settles verified success in APPLY mode and remains idempotent on subsequent runs", async () => {
    const staleUnknown = makeAttempt();
    mocks.attemptFindMany.mockResolvedValue([staleUnknown]);
    mocks.attemptFindUnique.mockResolvedValue(staleUnknown);
    mocks.paymentFindUnique.mockResolvedValue(staleUnknown.payment);
    const mockClient = {
      verifyTransaction: vi.fn().mockResolvedValue({
        id: 888179,
        domain: "live",
        status: "success",
        reference: "kt-payment-pay_kt_136446-attempt-1",
        amount: 17900,
        currency: "ZAR",
        channel: "card",
      }),
    };

    const first = await reconcileStalePaystackAttempts({
      mode: "APPLY",
      staleBefore: cutoff,
      clientOverride: mockClient as never,
    });
    expect(first).toMatchObject({ examined: 1, settled: 1, failed: 0, reconciled: 0, pending: 0 });
    expect(mocks.postLedger).toHaveBeenCalledTimes(1);
    expect(mocks.confirmCourier).toHaveBeenCalledTimes(1);

    // Second pass after settlement (simulating settled state still passed by query or empty)
    mocks.postLedger.mockClear();
    mocks.confirmCourier.mockClear();
    const alreadySettled = makeAttempt({
      status: "SUCCEEDED",
      payment: {
        status: "SUCCEEDED",
        successLedgerJournalId: "jrn-179",
        reconciliationStatus: "RESOLVED",
      },
    });
    mocks.attemptFindMany.mockResolvedValue([alreadySettled]);
    mocks.attemptFindUnique.mockResolvedValue(alreadySettled);

    const second = await reconcileStalePaystackAttempts({
      mode: "APPLY",
      staleBefore: cutoff,
      clientOverride: mockClient as never,
    });
    expect(second.settled).toBe(1);
    expect(second.items[0]?.outcome).toBe("ALREADY_SETTLED");
    expect(mocks.postLedger).not.toHaveBeenCalled();
    expect(mocks.confirmCourier).not.toHaveBeenCalled();
  });

  it("closes stale uninitialized attempt cleanly on confirmed PAYSTACK_TRANSACTION_NOT_FOUND and records PENDING cases as STALE_PROCESSING_ATTEMPT", async () => {
    const notFoundAttempt = makeAttempt();
    const pendingAttempt = makeAttempt({
      id: "att-249",
      paymentId: "pay-249",
      publicReference: "pat_249",
      merchantReference: "kt-payment-pay_kt_181078-attempt-1",
      amount: new Prisma.Decimal("249.00"),
      status: "REQUIRES_ACTION",
      payment: {
        id: "pay-249",
        publicReference: "pay_kt_181078",
        amount: new Prisma.Decimal("249.00"),
        status: "REQUIRES_ACTION",
        order: { orderNumber: "KT-2026-181078" },
      },
    });

    mocks.attemptFindMany.mockResolvedValue([notFoundAttempt, pendingAttempt]);
    mocks.attemptFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "att-179" ? notFoundAttempt : pendingAttempt,
    );
    mocks.paymentFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "pay-179" ? notFoundAttempt.payment : pendingAttempt.payment,
    );
    mocks.paymentStatusHistoryCreate.mockResolvedValue({ id: "psh-1" });

    const mockClient = {
      verifyTransaction: vi.fn(async (ref: string) => {
        if (ref === notFoundAttempt.merchantReference) {
          throw new PaymentError("PAYSTACK_TRANSACTION_NOT_FOUND", "Paystack has no transaction for this reference.");
        }
        return {
          id: 888249,
          domain: "live",
          status: "ongoing",
          reference: pendingAttempt.merchantReference,
          amount: 24900,
          currency: "ZAR",
        };
      }),
    };

    const report = await reconcileStalePaystackAttempts({
      mode: "APPLY",
      staleBefore: cutoff,
      clientOverride: mockClient as never,
    });

    expect(report).toMatchObject({ examined: 2, settled: 0, failed: 1, reconciled: 1, pending: 0 });
    expect(mocks.openRecon).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        paymentId: "pay-249",
        attemptId: "att-249",
        reason: "STALE_PROCESSING_ATTEMPT",
      }),
    );
  });

  it("scan-payment-reconciliation scans unexpiring REQUIRES_ACTION and stale RESERVED/REQUESTING attempts and avoids duplicate STALE_PROCESSING_ATTEMPT cases on RECONCILIATION_REQUIRED", async () => {
    const mismatchAttempt = {
      id: "att-scan-1",
      paymentId: "pay-scan-1",
      status: "REQUIRES_ACTION",
      publicReference: "pat_scan_1",
      provider: "PAYSTACK",
    };
    mocks.attemptFindMany.mockResolvedValue([mismatchAttempt]);
    mocks.attemptFindUnique.mockResolvedValue({
      ...makeAttempt({ id: "att-scan-1", paymentId: "pay-scan-1", publicReference: "pat_scan_1", status: "REQUIRES_ACTION" }),
    });
    mocks.paymentFindUnique.mockResolvedValue(makeAttempt({ id: "att-scan-1", paymentId: "pay-scan-1" }).payment);
    // Simulate unresolved due to RECONCILIATION_REQUIRED already opened (via pending webhook returning RECONCILIATION_REQUIRED)
    mocks.webhookFindFirst.mockResolvedValue({ id: "wh-conflict-1" });
    mocks.applyWebhook.mockResolvedValue({ outcome: "RECONCILIATION_REQUIRED", eventPublicReference: "wh_ref", ledgerJournalReference: null });

    const result = await PROCESSOR_HANDLERS["scan-payment-reconciliation"]({
      mode: "APPLY",
      batchSize: 10,
      operationId: "op-scan-1",
    });

    expect(mocks.attemptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ status: "UNKNOWN" }),
            expect.objectContaining({ status: { in: ["RESERVED", "REQUESTING"] } }),
            expect.objectContaining({
              status: "REQUIRES_ACTION",
              OR: expect.arrayContaining([{ expiresAt: null }]),
            }),
          ]),
        }),
      }),
    );
    expect(result.itemsReconciled).toBe(1);
    expect(mocks.openRecon).not.toHaveBeenCalled();
  });

  it("enforces PAYMENT_RECONCILIATION_MANAGE permission and authoritative evidence on domainAdapters.payments recovery", async () => {
    const readOnlyPerms = new Set([PERMISSIONS.PAYMENT_RECONCILIATION_READ]);
    await expect(
      executeUnifiedRecoveryCommand("usr-op", readOnlyPerms, {
        domain: "payments",
        reference: "prc_valid_case_ref_12345678",
        actionKey: "RETRY_PAYMENT_VERIFICATION",
        actorUserId: "usr-op",
        operationId: "RECOP-001",
        reasonCode: "RETRY",
      }),
    ).rejects.toThrow(/Unauthorized/);

    await expect(
      executeUnifiedRecoveryCommand("usr-op", readOnlyPerms, {
        domain: "payments",
        reference: "prc_valid_case_ref_12345678",
        actionKey: "MARK_RECONCILED",
        actorUserId: "usr-op",
        operationId: "RECOP-002",
        reasonCode: "MANUAL",
      }),
    ).rejects.toThrow(/Unauthorized/);

    const managePerms = new Set([
      PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE,
    ]);

    mocks.reconCaseFindUnique.mockResolvedValue({
      id: "prc-1",
      publicReference: "prc_valid_case_ref_12345678",
      paymentId: "pay-179",
      attemptId: "att-179",
      provider: "PAYSTACK",
      status: "OPEN",
      payment: { id: "pay-179", status: "PROCESSING", successLedgerJournalId: null },
      attempt: { id: "att-179", status: "UNKNOWN" },
    });

    // Cannot blindly mark an unresolved payment reconciled
    await expect(
      executeUnifiedRecoveryCommand("usr-op", managePerms, {
        domain: "payments",
        reference: "prc_valid_case_ref_12345678",
        actionKey: "MARK_RECONCILED",
        actorUserId: "usr-op",
        operationId: "RECOP-003",
        reasonCode: "MANUAL",
      }),
    ).rejects.toThrow(/unresolved|unverified/i);
    expect(mocks.reconCaseUpdate).not.toHaveBeenCalled();

    // RETRY_PAYMENT_VERIFICATION executes actual verification recovery and remains OPEN when still PENDING
    mocks.attemptFindUnique.mockResolvedValue(makeAttempt());
    const pendingRes = await domainAdapters.payments.executeRecovery({
      domain: "payments",
      reference: "prc_valid_case_ref_12345678",
      actionKey: "RETRY_PAYMENT_VERIFICATION",
      actorUserId: "usr-op",
      operationId: "RECOP-004",
      reasonCode: "RETRY",
    });
    expect(pendingRes.success).toBe(false);
    expect(pendingRes.updatedStatus).toBe("OPEN");
  });
});
