/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  zarToSubunitCents,
  subunitCentsToZar,
  validatePaystackAuthorizationUrl,
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
  KNOWN_REFUND_PROVIDER_CODES,
  createProductionRefundProviderRegistry,
} from "@/lib/refunds/providers/refund-provider-registry";
import {
  evaluateMarketplaceCheckoutPublicGate,
  assertMarketplaceCheckoutProductionReady,
  MarketplaceCheckoutProductionLockedError,
} from "@/lib/marketplace-checkout/production-lock";
import { withdrawalProductionReadiness } from "@/lib/withdrawals/withdrawal-production-readiness";
import { processPaystackWebhook } from "@/lib/services/paystack-webhook-application.service";
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
      upsert: vi.fn(async () => ({ id: "pwe_mock_id", publicReference: "pwe_mock_ref" })),
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
      create: vi.fn(async () => ({ publicReference: "pve_created_123" })),
    },
    notificationEventIntent: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => {
      if (typeof cb === "function") {
        return cb(prisma);
      }
      return Promise.all(cb);
    }),
    $queryRaw: vi.fn(async () => []),
  },
}));

describe("Paystack Financial Invariants", () => {
  const TEST_SECRET = "sk_test_e3f94721a998c253b940989f67a25d19484b901a";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYSTACK_MODE = "test";
    process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
  });

  describe("Exact ZAR Subunit Cents Conversion (No Float Drift)", () => {
    it("converts typical South African ZAR amounts to exact subunit cents", () => {
      expect(zarToSubunitCents("150.00")).toBe(15000);
      expect(zarToSubunitCents("0.50")).toBe(50);
      expect(zarToSubunitCents("1.01")).toBe(101);
      expect(zarToSubunitCents("999999999999.99")).toBe(99999999999999);
      expect(zarToSubunitCents(250)).toBe(25000);
    });

    it("rejects invalid, negative, or non-numeric ZAR amounts", () => {
      expect(() => zarToSubunitCents("0.00")).toThrow(/greater than zero/i);
      expect(() => zarToSubunitCents("-10.00")).toThrow(/Invalid ZAR amount/i);
      expect(() => zarToSubunitCents("150.005")).toThrow(/Invalid ZAR amount/i);
      expect(() => zarToSubunitCents("abc")).toThrow(/Invalid ZAR amount/i);
    });

    it("formats integer subunit cents back to canonical 2-decimal ZAR string", () => {
      expect(subunitCentsToZar(15000)).toBe("150.00");
      expect(subunitCentsToZar(50)).toBe("0.50");
      expect(subunitCentsToZar(101)).toBe("1.01");
      expect(subunitCentsToZar(0)).toBe("0.00");
    });
  });

  describe("HMAC-SHA512 Webhook Signature Verification", () => {
    const rawPayload = JSON.stringify({ event: "charge.success", data: { id: 123456, reference: "atm_test123", amount: 15000 } });

    it("generates and verifies valid Paystack HMAC-SHA512 signatures", () => {
      const signature = calculatePaystackHmac(rawPayload, TEST_SECRET);
      expect(typeof signature).toBe("string");
      expect(signature.length).toBe(128); // 64 bytes in hex
      expect(verifyPaystackSignature(rawPayload, signature, TEST_SECRET)).toBe(true);
    });

    it("rejects signature verification on tampered raw body", () => {
      const signature = calculatePaystackHmac(rawPayload, TEST_SECRET);
      const tamperedPayload = rawPayload.replace("15000", "15001");
      expect(verifyPaystackSignature(tamperedPayload, signature, TEST_SECRET)).toBe(false);
    });

    it("rejects signature verification with incorrect secret or malformed signature", () => {
      const signature = calculatePaystackHmac(rawPayload, TEST_SECRET);
      expect(verifyPaystackSignature(rawPayload, signature, "sk_test_wrong_secret")).toBe(false);
      expect(verifyPaystackSignature(rawPayload, "invalid_sig", TEST_SECRET)).toBe(false);
      expect(verifyPaystackSignature(rawPayload, null, TEST_SECRET)).toBe(false);
    });
  });

  describe("Paystack Safe Authorization URL Validation", () => {
    it("accepts valid HTTPS Paystack checkout URLs", () => {
      const validUrl = "https://checkout.paystack.com/access_code_123456";
      expect(validatePaystackAuthorizationUrl(validUrl)).toBe(validUrl);
      const standardUrl = "https://standard.paystack.co/pay/test";
      expect(validatePaystackAuthorizationUrl(standardUrl)).toBe(standardUrl);
    });

    it("rejects insecure HTTP protocols and untrusted domains", () => {
      expect(() => validatePaystackAuthorizationUrl("http://checkout.paystack.com/pay")).toThrow(/must use HTTPS/i);
      expect(() => validatePaystackAuthorizationUrl("https://evil-phishing-site.com/pay")).toThrow(/domain 'evil-phishing-site.com' is not permitted/i);
      expect(() => validatePaystackAuthorizationUrl("javascript:alert(1)")).toThrow(/HTTPS|malformed/i);
    });
  });

  describe("Dual-Provider Refund Architecture", () => {
    it("registers PAYFAST and PAYSTACK in KNOWN_REFUND_PROVIDER_CODES", () => {
      expect(KNOWN_REFUND_PROVIDER_CODES).toContain("PAYSTACK");
      expect(KNOWN_REFUND_PROVIDER_CODES).toContain("PAYFAST");
    });

    it("creates production refund registry with Paystack adapter", () => {
      const registry = createProductionRefundProviderRegistry();
      const adapter = registry.getAdapter("PAYSTACK");
      expect(adapter.code).toBe("PAYSTACK");
      expect(adapter.capabilities.supportsFullRefund).toBe(true);
      expect(adapter.capabilities.supportsPartialRefund).toBe(true);
    });

    it("enforces integer cents conversion on Paystack refund requests", async () => {
      const mockClient = {
        createRefund: vi.fn(async () => ({
          id: 998877,
          transaction: { id: 12345, reference: "atm_123" },
          deducted_amount: 5000,
          currency: "ZAR",
          status: "processed",
        })),
        getRefund: vi.fn(),
      } as unknown as PaystackClient;

      const adapter = new PaystackRefundAdapter(mockClient);
      const result = await adapter.createRefund(
        {
          refundPublicReference: "ref_1",
          paymentPublicReference: "pay_1",
          providerPaymentId: "12345",
          amount: "50.00",
          currency: "ZAR",
          reasonCode: "CUSTOMER_RETURN",
          providerOperationKey: "op_1",
        },
        { signal: new AbortController().signal, correlationId: "corr_1", timeoutMs: 5000 },
      );

      expect(mockClient.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: "12345",
          amountCents: 5000, // exact integer subunit cents!
          currency: "ZAR",
        }),
        expect.anything(),
      );
      expect(result.status).toBe("SUCCEEDED");
      expect(result.providerRefundId).toBe("998877");
    });
  });

  describe("Public Checkout Fail-Closed Production Gate", () => {
    it("fails closed when CHECKOUT_PUBLIC_ENABLED is false or missing", () => {
      const gateMissing = evaluateMarketplaceCheckoutPublicGate({});
      expect(gateMissing.enabled).toBe(false);
      expect(gateMissing.blockReason).toBe("CHECKOUT_PUBLIC_DISABLED");

      const gateFalse = evaluateMarketplaceCheckoutPublicGate({ CHECKOUT_PUBLIC_ENABLED: "false" });
      expect(gateFalse.enabled).toBe(false);
      expect(gateFalse.blockReason).toBe("CHECKOUT_PUBLIC_DISABLED");

      expect(() =>
        assertMarketplaceCheckoutProductionReady("PAYMENT", undefined, { CHECKOUT_PUBLIC_ENABLED: "false" }),
      ).toThrowError(MarketplaceCheckoutProductionLockedError);
    });

    it("fails closed when Paystack credentials are not configured", () => {
      const gate = evaluateMarketplaceCheckoutPublicGate({
        CHECKOUT_PUBLIC_ENABLED: "true",
        PAYSTACK_MODE: "disabled",
      });
      expect(gate.enabled).toBe(false);
      expect(gate.blockReason).toBe("PAYSTACK_DISABLED");
    });

    it("allows checkout when CHECKOUT_PUBLIC_ENABLED is true and Paystack is configured", () => {
      const gate = evaluateMarketplaceCheckoutPublicGate({
        CHECKOUT_PUBLIC_ENABLED: "true",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: TEST_SECRET,
        PAYMENT_APP_ORIGIN: "https://kt-courier.co.za",
      });
      expect(gate.enabled).toBe(true);
      expect(gate.blockReason).toBeNull();
    });
  });

  describe("Withdrawal Payout Fail-Closed Readiness Policy", () => {
    it("fails closed in production unless WITHDRAWAL_PAYOUT_ENABLED is explicitly true", () => {
      const readinessDisabled = withdrawalProductionReadiness({
        NODE_ENV: "production",
        WITHDRAWAL_PAYOUT_ENABLED: "false",
      });
      expect(readinessDisabled.productionActive).toBe(false);
      expect(readinessDisabled.blockReason).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");

      const readinessEnabled = withdrawalProductionReadiness({
        NODE_ENV: "production",
        WITHDRAWAL_PAYOUT_ENABLED: "true",
      });
      expect(readinessEnabled.productionActive).toBe(true);
      expect(readinessEnabled.payoutEnabled).toBe(true);
    });
  });

  describe("Paystack Webhook Financial Invariants & Idempotency", () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: {
        id: 778899,
        status: "success",
        reference: "atm_test_ref_1",
        amount: 15000,
        currency: "ZAR",
      },
    });
    const signature = calculatePaystackHmac(rawBody, TEST_SECRET);

    it("rejects webhook processing with invalid signature (HTTP 401 invariant)", async () => {
      await expect(
        processPaystackWebhook({
          rawBody,
          signature: "invalid_signature_hex",
        }),
      ).rejects.toThrow(/Paystack signature verification failed/i);
    });

    it("rejects amount mismatch and opens reconciliation case without posting ledger", async () => {
      // Attempt expects 20000 cents (R200.00), but webhook received 15000 cents (R150.00)
      (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce({
        id: "att_1",
        publicReference: "atm_test_ref_1",
        amount: { toString: () => "200.00" },
        currency: "ZAR",
        provider: "PAYSTACK",
        providerCredentialVersion: "test-v1",
        status: "REQUIRES_ACTION",
        payment: { id: "pay_1", publicReference: "pay_ref_1", amount: { toString: () => "200.00" }, currency: "ZAR" },
      });

      const mockClient = {
        verifyTransaction: vi.fn(async () => ({
          status: true,
          data: {
            id: 778899,
            status: "success",
            amount: 15000, // Verify API also returns 15000 cents
            currency: "ZAR",
            reference: "atm_test_ref_1",
          },
        })),
      } as unknown as PaystackClient;

      const result = await processPaystackWebhook({
        rawBody,
        signature,
        clientOverride: mockClient,
      });

      expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reconciliationStatus: "REQUIRED" },
        }),
      );
    });

    it("handles late success on CANCELLED/EXPIRED attempts by opening reconciliation case", async () => {
      (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce({
        id: "att_cancelled",
        publicReference: "atm_test_ref_1",
        amount: { toString: () => "150.00" },
        currency: "ZAR",
        provider: "PAYSTACK",
        providerCredentialVersion: "test-v1",
        status: "CANCELLED", // Customer cancelled or expired before webhook arrived
        payment: { id: "pay_1", publicReference: "pay_ref_1" },
      });

      const mockClient = {
        verifyTransaction: vi.fn(async () => ({
          status: true,
          data: {
            id: 778899,
            status: "success",
            amount: 15000,
            currency: "ZAR",
            reference: "atm_test_ref_1",
          },
        })),
      } as unknown as PaystackClient;

      const result = await processPaystackWebhook({
        rawBody,
        signature,
        clientOverride: mockClient,
      });

      // Must NOT silently mark as SUCCEEDED! Must open reconciliation case OUT_OF_ORDER_EVENT
      expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reconciliationStatus: "REQUIRED" },
        }),
      );
    });

    it("treats duplicate charge.success deliveries idempotently", async () => {
      (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce({
        id: "att_succeeded",
        publicReference: "atm_test_ref_1",
        amount: { toString: () => "150.00" },
        currency: "ZAR",
        provider: "PAYSTACK",
        providerCredentialVersion: "test-v1",
        status: "SUCCEEDED",
        payment: { id: "pay_1", publicReference: "pay_ref_1", status: "SUCCEEDED" },
      });

      (prisma.paymentWebhookEvent.findUnique as any).mockResolvedValueOnce({
        id: "pwe_existing",
        publicReference: "pwe_ref_1",
        ledgerJournalId: "jnl_1",
      });

      (prisma.ledgerJournal.findUnique as any).mockResolvedValueOnce({
        reference: "JNL-EXTERNAL-RECEIPT-1",
      });

      const mockClient = {
        verifyTransaction: vi.fn(async () => ({
          status: true,
          data: {
            id: 778899,
            status: "success",
            amount: 15000,
            currency: "ZAR",
            reference: "atm_test_ref_1",
          },
        })),
      } as unknown as PaystackClient;

      const result = await processPaystackWebhook({
        rawBody,
        signature,
        clientOverride: mockClient,
      });

      expect(result.outcome).toBe("DUPLICATE");
      expect(result.ledgerJournalReference).toBe("JNL-EXTERNAL-RECEIPT-1");
    });

    it("rejects currency mismatch and opens reconciliation case", async () => {
      (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce({
        id: "att_usd",
        publicReference: "atm_test_ref_1",
        amount: { toString: () => "150.00" },
        currency: "ZAR",
        provider: "PAYSTACK",
        providerCredentialVersion: "test-v1",
        status: "REQUIRES_ACTION",
        payment: { id: "pay_1", publicReference: "pay_ref_1", amount: { toString: () => "150.00" }, currency: "ZAR" },
      });

      const mockClient = {
        verifyTransaction: vi.fn(async () => ({
          status: true,
          data: {
            id: 778899,
            status: "success",
            amount: 15000,
            currency: "USD", // Mismatched currency!
            reference: "atm_test_ref_1",
          },
        })),
      } as unknown as PaystackClient;

      const result = await processPaystackWebhook({
        rawBody,
        signature,
        clientOverride: mockClient,
      });

      expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
      expect(prisma.paymentReconciliationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: "AMOUNT_MISMATCH",
            provider: "PAYSTACK",
          }),
        }),
      );
    });

    it("rejects webhook for unknown attempt reference safely", async () => {
      (prisma.paymentAttempt.findUnique as any).mockResolvedValueOnce(null);

      const result = await processPaystackWebhook({
        rawBody,
        signature,
      });

      expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
      expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            reconciliationReason: "PROVIDER_REFERENCE_CONFLICT",
            provider: "PAYSTACK",
          }),
        }),
      );
    });

    it("applies verified payment atomically with ledger receipt posting and outbox intent", async () => {
      (prisma.paymentAttempt.findUnique as any).mockResolvedValue({
        id: "att_1",
        publicReference: "atm_test_ref_1",
        attemptNumber: 1,
        amount: new Prisma.Decimal("150.00"),
        currency: "ZAR",
        provider: "PAYSTACK",
        providerCredentialVersion: "test-v1",
        status: "REQUIRES_ACTION",
        payment: {
          id: "pay_1",
          publicReference: "pay_ref_1",
          subjectType: "COURIER_ORDER",
          orderId: "ord_1",
          amount: new Prisma.Decimal("150.00"),
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
        amount: new Prisma.Decimal("150.00"),
        currency: "ZAR",
        status: "REQUIRES_ACTION",
        userId: "usr_1",
      });

      (prisma.paymentWebhookEvent.findUnique as any).mockResolvedValue(null);
      (prisma.paymentWebhookEvent.create as any).mockResolvedValue({
        id: "pwe_created",
        publicReference: "pwe_ref_123",
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
          wallet: { status: "ACTIVE", currency: "ZAR", ownerType: "PLATFORM", ownerId: "platform" },
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
          wallet: { status: "ACTIVE", currency: "ZAR", ownerType: "PLATFORM", ownerId: "platform" },
        },
      ]);

      (prisma.$queryRaw as any).mockResolvedValue([
        { id: "acc_cash" },
        { id: "acc_held" },
      ]);

      (prisma.ledgerJournal.create as any).mockResolvedValue({
        id: "jnl_123",
        reference: "JNL-EXTERNAL-RECEIPT-SUCCESS",
      });

      (prisma.ledgerJournal.findUnique as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "jnl_123",
          reference: "JNL-EXTERNAL-RECEIPT-SUCCESS",
          totalDebits: new Prisma.Decimal("150.00"),
          totalCredits: new Prisma.Decimal("150.00"),
          postedAt: new Date(),
          createdAt: new Date(),
          entries: [],
        });

      (prisma.order.findUnique as any).mockResolvedValue({
        id: "ord_1",
        orderNumber: "KT-ORD-1001",
      });

      const mockClient = {
        verifyTransaction: vi.fn(async () => ({
          status: true,
          data: {
            id: 778899,
            status: "success",
            amount: 15000,
            currency: "ZAR",
            reference: "atm_test_ref_1",
          },
        })),
      } as unknown as PaystackClient;

      const result = await processPaystackWebhook({
        rawBody,
        signature,
        clientOverride: mockClient,
      });

      expect(result.outcome).toBe("APPLIED");
      expect(result.ledgerJournalReference).toBe("JNL-EXTERNAL-RECEIPT-SUCCESS");
      expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "SUCCEEDED",
            providerReference: "778899",
          }),
        }),
      );
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "SUCCEEDED",
            reconciliationStatus: "RESOLVED",
          }),
        }),
      );
    });
  });
});
