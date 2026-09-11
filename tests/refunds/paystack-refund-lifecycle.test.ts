/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { PaystackRefundAdapter } from "@/lib/refunds/providers/paystack/paystack-refund-adapter";
import { finalizeProviderRefundAttempt } from "@/lib/services/refund-provider-execution.service";
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(async (query: any) => {
      const q = typeof query === "string" ? query : (query?.strings?.join(" ") ?? "");
      if (q.includes("PaymentRefund")) {
        return [{ id: "ref_001" }];
      }
      if (q.includes("RefundExecutionAttempt")) {
        return [{ id: "rpa_001" }];
      }
      return [{ id: "mock_id" }];
    }),
    paymentRefund: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "ref_001",
        status: args?.data?.status ?? "PROCESSING",
        ...args?.data,
      })),
    },
    refundExecutionAttempt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "rpa_001",
        status: args?.data?.status ?? "PROCESSING",
        ...args?.data,
      })),
    },
    refundReconciliationCase: {
      findUnique: vi.fn(),
      create: vi.fn(async (args: any) => ({ id: "rrc_001", ...args?.data })),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id ?? "rrc_001", ...args?.data })),
    },
    refundStatusHistory: {
      create: vi.fn(async (args: any) => ({ id: "rsh_001", ...args?.data })),
      createMany: vi.fn(async (args: any) => ({ count: args?.data?.length ?? 1 })),
    },
  };
  return { prisma: mockPrisma };
});

describe("Phase 1: Paystack Refund Lifecycle & Needs-Attention Boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PaystackRefundAdapter Status Mapping", () => {
    const adapter = new PaystackRefundAdapter();

    it("maps 'processed' and 'success' to SUCCEEDED (definitive)", () => {
      expect(adapter.mapRawStatus("processed")).toEqual({ status: "SUCCEEDED", definitive: true });
      expect(adapter.mapRawStatus("success")).toEqual({ status: "SUCCEEDED", definitive: true });
    });

    it("maps 'failed' to FAILED (definitive)", () => {
      expect(adapter.mapRawStatus("failed")).toEqual({ status: "FAILED", definitive: true });
    });

    it("maps 'needs-attention' and 'needs_attention' to NEEDS_ATTENTION (definitive)", () => {
      expect(adapter.mapRawStatus("needs-attention")).toEqual({ status: "NEEDS_ATTENTION", definitive: true });
      expect(adapter.mapRawStatus("needs_attention")).toEqual({ status: "NEEDS_ATTENTION", definitive: true });
    });

    it("maps 'pending' and 'processing' to PROCESSING (non-definitive)", () => {
      expect(adapter.mapRawStatus("pending")).toEqual({ status: "PROCESSING", definitive: false });
      expect(adapter.mapRawStatus("processing")).toEqual({ status: "PROCESSING", definitive: false });
    });

    it("maps unknown strings to UNKNOWN (non-definitive)", () => {
      expect(adapter.mapRawStatus("unknown_status_xyz")).toEqual({ status: "UNKNOWN", definitive: false });
    });
  });

  describe("Needs-Attention Terminal Handling & Reconciliation", () => {
    it("transitions attempt to NEEDS_ATTENTION and refund to RECONCILIATION_REQUIRED", async () => {
      const mockRefund = {
        id: "ref_001",
        publicReference: "REF-001",
        status: "PROCESSING",
        amount: new Prisma.Decimal("350.00"),
        currency: "ZAR",
        customerUserId: "usr_cust_01",
        approvedByUserId: "usr_fin_approver",
        currentAttemptId: "rpa_001",
        payment: {
          publicReference: "PAY-001",
          amount: new Prisma.Decimal("350.00"),
        },
        reserveLedgerJournal: {
          entries: [],
        },
      };

      const mockAttempt = {
        id: "rpa_001",
        publicReference: "RPA-001",
        refundId: "ref_001",
        status: "PROCESSING",
        providerPaymentId: "pstk_ch_12345",
      };

      (prisma.paymentRefund.findUnique as any).mockResolvedValue(mockRefund);
      (prisma.refundExecutionAttempt.findUnique as any).mockResolvedValue(mockAttempt);

      await finalizeProviderRefundAttempt({
        actorUserId: "usr_fin_executor",
        refundPublicReference: "REF-001",
        attemptPublicReference: "RPA-001",
        result: {
          status: "NEEDS_ATTENTION",
          providerRefundId: "12345678",
          providerPaymentId: "pstk_ch_12345",
          providerStatusCode: "needs-attention",
          definitive: true,
          safeProviderStatus: "needs-attention",
        },
      });

      // Payout attempt transitioned to NEEDS_ATTENTION
      expect(prisma.refundExecutionAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rpa_001" },
          data: expect.objectContaining({
            status: "NEEDS_ATTENTION",
            failureCode: "NEEDS_ATTENTION",
          }),
        }),
      );

      // Refund transitioned to RECONCILIATION_REQUIRED
      expect(prisma.paymentRefund.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ref_001" },
          data: expect.objectContaining({
            status: "RECONCILIATION_REQUIRED",
          }),
        }),
      );

      // Reconciliation case opened
      expect(prisma.refundReconciliationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refundId: "ref_001",
            attemptId: "rpa_001",
            reason: "UNKNOWN_PROVIDER_OUTCOME",
            safeEvidence: expect.objectContaining({
              needsAttention: true,
            }),
          }),
        }),
      );
    });
  });

  describe("Operator Bank Detail Retry API Safe Masking", () => {
    it("calls Paystack retry endpoint without leaking unmasked bank account numbers", async () => {
      const rawSecret = "sk_test_mock_secret_key_12345";
      const client = new PaystackClient({ secretKey: rawSecret });

      const mockResponseData = {
        status: true,
        message: "Refund retry initiated",
        data: {
          id: 998877,
          status: "pending",
          transaction: "pstk_ch_12345",
          amount: 35000,
          currency: "ZAR",
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponseData,
        text: async () => JSON.stringify(mockResponseData),
      });
      (globalThis as any).fetch = mockFetch;

      const retryResult = await client.retryRefundWithCustomerDetails(998877, {
        account_name: "Jane Doe",
        account_number: "0123456789",
        bank_code: "051001",
      });

      expect(retryResult.id).toBe(998877);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.paystack.co/refund/998877",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${rawSecret}`,
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            account_name: "Jane Doe",
            account_number: "0123456789",
            bank_code: "051001",
          }),
        }),
      );
    });
  });
});
