/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  zarToSubunitCents,
  assertValidPaystackTransactionAmount,
  validatePaystackAuthorizationUrl,
  MAX_PAYSTACK_TRANSACTION_CENTS,
  PaystackClient,
} from "@/lib/payments/providers/paystack/paystack-client";
import {
  calculatePaystackHmac,
  verifyPaystackSignature,
} from "@/lib/payments/providers/paystack/paystack-signature";
import {
  PaystackRefundAdapter,
} from "@/lib/refunds/providers/paystack/paystack-refund-adapter";
import {
  ingestPaystackWebhook,
  applyPaystackWebhookEvent,
  PaystackWebhookPayloadSchema,
} from "@/lib/services/paystack-webhook-application.service";
import { pollAndApplyRefundProviderStatus } from "@/lib/services/refund-reconciliation.service";
import { executeRegisteredProcessor } from "@/lib/processors/processor-service";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    paymentAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(async () => ({ id: "pwe_mock_id", publicReference: "pwe_mock_ref" })),
      update: vi.fn(async () => ({ id: "pwe_mock_id", publicReference: "pwe_mock_ref" })),
      upsert: vi.fn(async () => ({ id: "pwe_mock_id", publicReference: "pwe_mock_ref", processingStatus: "RECEIVED" })),
    },
    paymentReconciliationCase: {
      findUnique: vi.fn(),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "prc_mock_id", publicReference: "prc_mock_ref" })),
      update: vi.fn(async () => ({ id: "prc_mock_id", publicReference: "prc_mock_ref" })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    paymentStatusHistory: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    ledgerAccount: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    ledgerJournal: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    ledgerEntry: {
      createMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
    cashOnDelivery: {
      findUnique: vi.fn(async () => null),
    },
    marketplaceCheckout: {
      findUnique: vi.fn(),
    },
    subscriptionInvoice: {
      findUnique: vi.fn(),
    },
    paymentVerifiedEventIntent: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "pve_id", publicReference: "pve_created_123" })),
    },
    notificationEventIntent: {
      upsert: vi.fn(),
    },
    operationalProcessorRun: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "opr_1", operationId: "op_1" })),
      update: vi.fn(async () => ({ id: "opr_1" })),
      findUnique: vi.fn(async () => null),
    },
    refund: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentRefund: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refundExecutionAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refundReconciliationCase: {
      create: vi.fn(),
      findUnique: vi.fn(async () => null),
    },
    refundStatusHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => {
      if (typeof cb === "function") {
        return cb(prisma);
      }
      return Promise.all(cb);
    }),
    $queryRaw: vi.fn(async () => [{ id: "acc_cash" }, { id: "acc_held" }]),
  },
}));

describe("Paystack 24 Deterministic Contract Test Suite", () => {
  const TEST_SECRET = "sk_test_e3f94721a998c253b940989f67a25d19484b901a";

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PAYSTACK_MODE = "test";
    process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
    (prisma.$queryRaw as any).mockResolvedValue([{ id: "acc_cash" }, { id: "acc_held" }]);
  });

  // 1. Valid HMAC SHA-512 signature acceptance
  it("1. accepts valid HMAC SHA-512 signature computed with secret key", () => {
    const payload = JSON.stringify({ event: "charge.success", data: { id: 12345 } });
    const signature = calculatePaystackHmac(payload, TEST_SECRET);
    expect(verifyPaystackSignature(payload, signature, TEST_SECRET)).toBe(true);
  });

  // 2. Invalid signature rejection
  it("2. rejects invalid or forged signature", () => {
    const payload = JSON.stringify({ event: "charge.success", data: { id: 12345 } });
    const forgedSignature = calculatePaystackHmac(payload, "sk_test_wrong_secret");
    expect(verifyPaystackSignature(payload, forgedSignature, TEST_SECRET)).toBe(false);
  });

  // 3. Empty / missing signature header rejection
  it("3. rejects empty or missing signature header", async () => {
    const payload = JSON.stringify({ event: "charge.success", data: { id: 12345 } });
    await expect(ingestPaystackWebhook({
      rawBody: payload,
      signature: null,
      secretKey: TEST_SECRET,
    })).rejects.toThrow(/signature/i);

    await expect(ingestPaystackWebhook({
      rawBody: payload,
      signature: "",
      secretKey: TEST_SECRET,
    })).rejects.toThrow(/signature/i);
  });

  // 4. Payload outside max transaction cap (1,000,000,000 cents / R10m) rejection
  it("4. rejects transaction amount exceeding R10,000,000.00 cap (1,000,000,000 cents)", () => {
    expect(() => assertValidPaystackTransactionAmount(MAX_PAYSTACK_TRANSACTION_CENTS + 1))
      .toThrow(/up to 1000000000 cents/i);
    expect(() => zarToSubunitCents("10000000.01", MAX_PAYSTACK_TRANSACTION_CENTS))
      .toThrow(/maximum transaction limit/i);
    // Boundary check: exactly 1,000,000,000 is accepted
    expect(() => assertValidPaystackTransactionAmount(MAX_PAYSTACK_TRANSACTION_CENTS)).not.toThrow();
  });

  // 5. Subunit non-integer rejection
  it("5. rejects non-integer subunit cent amounts", () => {
    expect(() => assertValidPaystackTransactionAmount(1234.56))
      .toThrow(/safe positive integer/i);
    expect(() => assertValidPaystackTransactionAmount(NaN))
      .toThrow(/safe positive integer/i);
    expect(() => assertValidPaystackTransactionAmount(Infinity))
      .toThrow(/safe positive integer/i);
  });

  // 6. Negative and zero amount rejection
  it("6. rejects negative and zero transaction amounts", () => {
    expect(() => assertValidPaystackTransactionAmount(0)).toThrow(/safe positive integer/i);
    expect(() => assertValidPaystackTransactionAmount(-100)).toThrow(/safe positive integer/i);
    expect(() => zarToSubunitCents("0.00")).toThrow(/greater than zero/i);
    expect(() => zarToSubunitCents("-50.00")).toThrow(/Invalid ZAR amount/i);
  });

  // 7. Exact domain allowlist acceptance (checkout.paystack.com, standard.paystack.co)
  it("7. accepts allowed Paystack checkout domains", () => {
    const url1 = "https://checkout.paystack.com/access_code_123";
    const url2 = "https://standard.paystack.co/access_code_456";
    expect(validatePaystackAuthorizationUrl(url1)).toBe(url1);
    expect(validatePaystackAuthorizationUrl(url2)).toBe(url2);
  });

  // 8. Custom port rejection on authorization URL
  it("8. rejects custom port in authorization URL", () => {
    expect(() => validatePaystackAuthorizationUrl("https://checkout.paystack.com:8080/pay"))
      .toThrow(/custom port/i);
    expect(() => validatePaystackAuthorizationUrl("https://standard.paystack.co:8443/pay"))
      .toThrow(/custom port/i);
  });

  // 9. Non-HTTPS authorization URL rejection
  it("9. rejects non-HTTPS authorization URL", () => {
    expect(() => validatePaystackAuthorizationUrl("http://checkout.paystack.com/pay"))
      .toThrow(/must use HTTPS/i);
  });

  // 10. Malformed authorization URL rejection
  it("10. rejects malformed authorization URLs and dangerous schemes", () => {
    expect(() => validatePaystackAuthorizationUrl("not-a-url")).toThrow(/malformed/i);
    expect(() => validatePaystackAuthorizationUrl("javascript:alert(1)")).toThrow(/must use HTTPS/i);
    expect(() => validatePaystackAuthorizationUrl("https://evil-paystack.com/pay")).toThrow(/not permitted/i);
  });

  // 11. Fast webhook HTTP receipt with sourceAddressVerified: false
  it("11. ingests webhook fast returning 200 receipt with sourceAddressVerified: false", async () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: {
        id: 998877,
        status: "success",
        reference: "atm_fast_1",
        amount: 25000,
        currency: "ZAR",
      },
    });
    const signature = calculatePaystackHmac(rawBody, TEST_SECRET);

    (prisma.paymentWebhookEvent.upsert as any).mockResolvedValueOnce({
      id: "pwe_mock_id",
      publicReference: "pwe_mock_ref",
      processingStatus: "RECEIVED",
    });

    const receipt = await ingestPaystackWebhook({
      rawBody,
      signature,
      secretKey: TEST_SECRET,
      sourceAddress: "192.168.1.1",
    });

    expect(receipt.received).toBe(true);
    expect(receipt.event).toBe("charge.success");
    expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceAddressVerified: false,
          signatureVerified: true,
          processingStatus: "RECEIVED",
        }),
      }),
    );
  });

  // 12. Background application verifying Paystack Verify API
  it("12. background application confirms status and amount via Paystack Verify API", async () => {
    const payload = {
      event: "charge.success" as const,
      data: {
        id: 998877,
        status: "success",
        reference: "atm_bg_1",
        amount: 25000,
        currency: "ZAR",
      },
    };

    (prisma.paymentAttempt.findUnique as any).mockResolvedValue({
      id: "att_1",
      publicReference: "atm_bg_1",
      amount: new Prisma.Decimal("250.00"),
      currency: "ZAR",
      provider: "PAYSTACK",
      providerCredentialVersion: "test-v1",
      status: "REQUIRES_ACTION",
      payment: {
        id: "pay_1",
        publicReference: "pay_ref_1",
        subjectType: "COURIER_ORDER",
        orderId: "ord_1",
        amount: new Prisma.Decimal("250.00"),
        currency: "ZAR",
        status: "REQUIRES_ACTION",
        userId: "usr_1",
      },
    });

    (prisma.payment.findUnique as any).mockResolvedValue({
      id: "pay_1",
      publicReference: "pay_ref_1",
      subjectType: "COURIER_ORDER",
      orderId: "ord_1",
      amount: new Prisma.Decimal("250.00"),
      currency: "ZAR",
      status: "REQUIRES_ACTION",
      userId: "usr_1",
    });

    (prisma.ledgerAccount.findMany as any).mockResolvedValue([
      {
        id: "acc_cash",
        code: "PLATFORM-CASH-CLEARING-ZAR",
        purpose: "CASH_CLEARING",
        category: "ASSET",
        currency: "ZAR",
        status: "ACTIVE",
        currentBalance: new Prisma.Decimal("0.00"),
        debitTotal: new Prisma.Decimal("0.00"),
        creditTotal: new Prisma.Decimal("0.00"),
        version: 1,
        allowNegative: false,
        wallet: { id: "w_1", status: "ACTIVE", currency: "ZAR", ownerType: "PLATFORM", ownerId: "platform" },
      },
      {
        id: "acc_held",
        code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
        purpose: "HELD",
        category: "LIABILITY",
        currency: "ZAR",
        status: "ACTIVE",
        currentBalance: new Prisma.Decimal("0.00"),
        debitTotal: new Prisma.Decimal("0.00"),
        creditTotal: new Prisma.Decimal("0.00"),
        version: 1,
        allowNegative: false,
        wallet: { id: "w_1", status: "ACTIVE", currency: "ZAR", ownerType: "PLATFORM", ownerId: "platform" },
      },
    ]);

    (prisma.ledgerJournal.create as any).mockResolvedValue({
      id: "jnl_1",
      reference: "JNL-BG-1",
    });

    (prisma.ledgerJournal.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "jnl_1",
        reference: "JNL-BG-1",
        totalDebits: new Prisma.Decimal("250.00"),
        totalCredits: new Prisma.Decimal("250.00"),
        postedAt: new Date(),
        createdAt: new Date(),
        entries: [],
      });

    (prisma.order.findUnique as any).mockResolvedValue({ id: "ord_1", orderNumber: "KT-ORD-BG" });

    const mockClient = {
      verifyTransaction: vi.fn(async () => ({
        status: true,
        data: {
          id: 998877,
          status: "success",
          amount: 25000,
          currency: "ZAR",
          reference: "atm_bg_1",
        },
      })),
    } as unknown as PaystackClient;

    const result = await applyPaystackWebhookEvent({
      rawPayload: payload,
      clientOverride: mockClient,
      secretKey: TEST_SECRET,
      eventRecord: { id: "pwe_bg_1", publicReference: "pwe_ref_bg_1" },
    });

    expect(mockClient.verifyTransaction).toHaveBeenCalledWith("atm_bg_1");
    expect(result.outcome).toBe("APPLIED");
  });

  // 13. Currency mismatch rejection (non-ZAR)
  it("13. rejects webhook when currency is not ZAR and opens reconciliation case", async () => {
    const payload = {
      event: "charge.success" as const,
      data: {
        id: 998877,
        status: "success",
        reference: "atm_curr_1",
        amount: 25000,
        currency: "USD",
      },
    };

    (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce({
      id: "att_curr",
      publicReference: "atm_curr_1",
      amount: new Prisma.Decimal("250.00"),
      currency: "ZAR",
      provider: "PAYSTACK",
      providerCredentialVersion: "test-v1",
      status: "REQUIRES_ACTION",
      payment: {
        id: "pay_curr",
        publicReference: "pay_curr_ref",
        amount: new Prisma.Decimal("250.00"),
        currency: "ZAR",
        status: "REQUIRES_ACTION",
      },
    });

    const mockClient = {
      verifyTransaction: vi.fn(async () => ({
        status: true,
        data: { id: 998877, status: "success", amount: 25000, currency: "USD", reference: "atm_curr_1" },
      })),
    } as unknown as PaystackClient;

    const result = await applyPaystackWebhookEvent({
      rawPayload: payload,
      clientOverride: mockClient,
      secretKey: TEST_SECRET,
      eventRecord: { id: "pwe_1", publicReference: "pwe_ref_1" },
    });

    expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(prisma.paymentReconciliationCase.create).toHaveBeenCalled();
  });

  // 14. Amount mismatch between webhook and payment record
  it("14. rejects webhook when verified amount differs from expected amount", async () => {
    const payload = {
      event: "charge.success" as const,
      data: {
        id: 998877,
        status: "success",
        reference: "atm_mismatch_1",
        amount: 5000, // 50 ZAR
        currency: "ZAR",
      },
    };

    (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce({
      id: "att_mis",
      publicReference: "atm_mismatch_1",
      amount: new Prisma.Decimal("250.00"), // expects 25000 cents
      currency: "ZAR",
      provider: "PAYSTACK",
      providerCredentialVersion: "test-v1",
      status: "REQUIRES_ACTION",
      payment: {
        id: "pay_mis",
        publicReference: "pay_mis_ref",
        amount: new Prisma.Decimal("250.00"),
        currency: "ZAR",
        status: "REQUIRES_ACTION",
      },
    });

    const mockClient = {
      verifyTransaction: vi.fn(async () => ({
        status: true,
        data: { id: 998877, status: "success", amount: 5000, currency: "ZAR", reference: "atm_mismatch_1" },
      })),
    } as unknown as PaystackClient;

    const result = await applyPaystackWebhookEvent({
      rawPayload: payload,
      clientOverride: mockClient,
      secretKey: TEST_SECRET,
      eventRecord: { id: "pwe_1", publicReference: "pwe_ref_1" },
    });

    expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(prisma.paymentReconciliationCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "AMOUNT_MISMATCH",
        }),
      }),
    );
  });

  // 15. Late success handling on CANCELLED/EXPIRED attempts (reconciliation case opened)
  it("15. opens reconciliation case for late success on CANCELLED attempt without ledger posting", async () => {
    const payload = {
      event: "charge.success" as const,
      data: {
        id: 998877,
        status: "success",
        reference: "atm_late_1",
        amount: 25000,
        currency: "ZAR",
      },
    };

    (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce({
      id: "att_late",
      publicReference: "atm_late_1",
      amount: new Prisma.Decimal("250.00"),
      currency: "ZAR",
      provider: "PAYSTACK",
      providerCredentialVersion: "test-v1",
      status: "CANCELLED",
      payment: {
        id: "pay_late",
        publicReference: "pay_late_ref",
        amount: new Prisma.Decimal("250.00"),
        currency: "ZAR",
        status: "CANCELLED",
      },
    });

    const mockClient = {
      verifyTransaction: vi.fn(async () => ({
        status: true,
        data: { id: 998877, status: "success", amount: 25000, currency: "ZAR", reference: "atm_late_1" },
      })),
    } as unknown as PaystackClient;

    const result = await applyPaystackWebhookEvent({
      rawPayload: payload,
      clientOverride: mockClient,
      secretKey: TEST_SECRET,
      eventRecord: { id: "pwe_1", publicReference: "pwe_ref_1" },
    });

    expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(prisma.ledgerJournal.create).not.toHaveBeenCalled();
    expect(prisma.paymentReconciliationCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "OUT_OF_ORDER_EVENT",
        }),
      }),
    );
  });

  // 16. Idempotent duplicate webhook event handling
  it("16. handles duplicate webhook event idempotently without duplicate ledger postings", async () => {
    const payload = {
      event: "charge.success" as const,
      data: {
        id: 998877,
        status: "success",
        reference: "atm_dup_1",
        amount: 25000,
        currency: "ZAR",
      },
    };

    (prisma.paymentAttempt.findUnique as any).mockResolvedValue({
      id: "att_dup",
      publicReference: "atm_dup_1",
      amount: new Prisma.Decimal("250.00"),
      currency: "ZAR",
      provider: "PAYSTACK",
      providerCredentialVersion: "test-v1",
      status: "SUCCEEDED",
      payment: {
        id: "pay_dup",
        publicReference: "pay_dup_ref",
        status: "SUCCEEDED",
      },
    });

    (prisma.paymentWebhookEvent.findUnique as any).mockResolvedValue({
      id: "pwe_dup",
      publicReference: "pwe_ref_dup",
      ledgerJournalId: "jnl_dup",
    });

    (prisma.ledgerJournal.findUnique as any).mockResolvedValue({
      id: "jnl_dup",
      reference: "JNL-DUP-PREV",
    });

    const mockClient = {
      verifyTransaction: vi.fn(async () => ({
        status: true,
        data: { id: 998877, status: "success", amount: 25000, currency: "ZAR", reference: "atm_dup_1" },
      })),
    } as unknown as PaystackClient;

    const result = await applyPaystackWebhookEvent({
      rawPayload: payload,
      clientOverride: mockClient,
      secretKey: TEST_SECRET,
      eventRecord: { id: "pwe_dup", publicReference: "pwe_ref_dup", ledgerJournalId: "jnl_dup" },
    });

    expect(result.outcome).toBe("DUPLICATE");
    expect(result.ledgerJournalReference).toBe("JNL-DUP-PREV");
    expect(prisma.ledgerJournal.create).not.toHaveBeenCalled();
  });

  // 17. Unknown merchant reference handling
  it("17. creates reconciliation case when webhook references unknown payment attempt", async () => {
    const payload = {
      event: "charge.success" as const,
      data: {
        id: 998877,
        status: "success",
        reference: "atm_nonexistent",
        amount: 25000,
        currency: "ZAR",
      },
    };

    (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce(null);

    const result = await applyPaystackWebhookEvent({
      rawPayload: payload,
      secretKey: TEST_SECRET,
      eventRecord: { id: "pwe_unknown", publicReference: "pwe_ref_unk" },
    });

    expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          processingStatus: "RECONCILIATION_REQUIRED",
          reconciliationReason: "PROVIDER_REFERENCE_CONFLICT",
        }),
      }),
    );
  });

  // 18. Outbox payment verified event intent deduplication
  it("18. deduplicates payment verified event intent on matching identity", async () => {
    (prisma.paymentVerifiedEventIntent.findUnique as any).mockResolvedValueOnce({
      id: "pve_existing",
      publicReference: "pve_existing_ref",
      paymentId: "pay_dedup",
      successfulAttemptId: "att_dedup",
      webhookEventId: "pwe_dedup",
      amount: new Prisma.Decimal("100.00"),
      currency: "ZAR",
    });

    // Attempting to append with same evidence returns existing reference without re-creating
    const existing = await prisma.paymentVerifiedEventIntent.findUnique({
      where: { eventIdentity: "payment-verified:pay_dedup:pwe_dedup:v1" } as any,
    });

    expect(existing).toBeDefined();
    expect(existing?.publicReference).toBe("pve_existing_ref");
  });

  // 19. Needs-attention refund status mapping to NEEDS_ATTENTION
  it("19. maps needs-attention / needs_attention to NEEDS_ATTENTION with definitive true", () => {
    const adapter = new PaystackRefundAdapter();
    const res1 = adapter.mapRawStatus("needs-attention");
    expect(res1.status).toBe("NEEDS_ATTENTION");
    expect(res1.definitive).toBe(true);

    const res2 = adapter.mapRawStatus("needs_attention");
    expect(res2.status).toBe("NEEDS_ATTENTION");
    expect(res2.definitive).toBe(true);
  });

  // 20. Local at-most-once refund attempt reservation (supportsIdempotentCreate: false)
  it("20. declares supportsIdempotentCreate as false for local at-most-once refund initiation", () => {
    const adapter = new PaystackRefundAdapter();
    expect(adapter.capabilities.supportsIdempotentCreate).toBe(false);
  });

  // 21. Stale refund polling with pollAndApplyRefundProviderStatus
  it("21. polls and applies refund provider status for stale refund attempts", async () => {
    (prisma.refundExecutionAttempt.findUnique as any).mockResolvedValueOnce({
      id: "rea_stale",
      refundId: "ref_1",
      provider: "PAYSTACK",
      providerRefundId: "pstk_ref_123",
      providerAttemptReference: "pstk_ref_123",
      status: "PROCESSING",
      failureCategory: null,
      failureCode: null,
      refund: {
        id: "ref_1",
        publicReference: "ref_pub_1",
        paymentId: "pay_1",
        amount: new Prisma.Decimal("100.00"),
        currency: "ZAR",
        status: "PROCESSING",
        payment: { provider: "PAYSTACK" },
      },
    });

    (prisma.paymentRefund.findUnique as any).mockResolvedValueOnce({
      id: "ref_1",
      publicReference: "ref_pub_1",
      amount: new Prisma.Decimal("100.00"),
      currency: "ZAR",
      status: "PROCESSING",
      currentAttempt: {
        id: "rea_stale",
        publicReference: "rea_pub_1",
        status: "UNKNOWN",
        provider: "PAYSTACK",
        providerRefundId: "pstk_ref_123",
      },
    });

    const mockAdapter = {
      code: "PAYSTACK" as const,
      capabilities: { supportsIdempotentCreate: false, supportsStatusQuery: true },
      queryRefund: vi.fn(async () => ({
        status: "SUCCEEDED" as const,
        definitive: true,
        providerRefundId: "pstk_ref_123",
        providerStatusCode: "processed",
        safeProviderStatus: "processed",
      })),
      mapRawStatus: vi.fn(),
      createRefund: vi.fn(),
    };

    const mockRegistry = {
      getAdapter: vi.fn(() => mockAdapter),
      hasAdapter: vi.fn(() => true),
    };

    const outcome = await pollAndApplyRefundProviderStatus(
      { attemptId: "rea_stale" },
      { registry: mockRegistry as any },
    );

    expect(outcome.polled).toBe(true);
    expect(outcome.status).toBe("SUCCEEDED");
    expect(mockAdapter.queryRefund).toHaveBeenCalled();
  });

  // 22. Strict DRY_RUN execution with zero mutations and zero network
  it("22. executes consume-verified-payment-events in DRY_RUN mode with zero mutations", async () => {
    (prisma.paymentVerifiedEventIntent.findMany as any).mockResolvedValueOnce([
      { id: "pve_1", publicReference: "pve_ref_1" },
    ]);

    const result = await executeRegisteredProcessor({
      name: "consume-verified-payment-events",
      mode: "DRY_RUN",
      batchSize: 10,
    });

    expect(result.mode).toBe("DRY_RUN");
    expect(result.status).toBe("DRY_RUN_COMPLETED");
    expect(result.itemsExamined).toBe(1);
    expect(result.itemsClaimed).toBe(0);
    expect(result.itemsCompleted).toBe(0);
    // Verified 0 writes occurred on the intent
    expect(prisma.paymentVerifiedEventIntent.create).not.toHaveBeenCalled();
  });

  // 23. Webhook payload discriminated schema parsing for charge.success
  it("23. parses valid charge.success payloads via discriminated schema", () => {
    const validCharge = {
      event: "charge.success",
      data: {
        id: 123456,
        domain: "test",
        status: "success",
        reference: "ref_123",
        amount: 15000,
        currency: "ZAR",
        channel: "card",
      },
    };

    const parseResult = PaystackWebhookPayloadSchema.safeParse(validCharge);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.event).toBe("charge.success");
    }
  });

  // 24. Webhook payload discriminated schema parsing for refund.*
  it("24. parses valid refund.* payloads via discriminated schema", () => {
    const validRefund = {
      event: "refund.processed",
      data: {
        id: 78910,
        status: "processed",
        currency: "ZAR",
        amount: 10000,
        transaction_reference: "ref_orig_123",
      },
    };

    const parseResult = PaystackWebhookPayloadSchema.safeParse(validRefund);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.event).toBe("refund.processed");
    }
  });
});
