/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  openPaymentDispute,
  updatePaymentDisputeEvidence,
  resolvePaymentDispute,
  sanitizeEvidenceSnapshot,
} from "@/lib/services/payment-dispute.service";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(async (query: any) => {
      const q = typeof query === "string" ? query : (query?.strings?.join(" ") ?? "");
      if (q.includes("LedgerAccount")) {
        const ids = Array.isArray(query?.values) && query.values.length > 0 ? query.values : ["acc_cust_held", "acc_disp_held"];
        return ids.map((id: string) => ({ id }));
      }
      return [{ id: "mock_id" }];
    }),
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id ?? "pay_001", ...args?.data })),
    },
    paymentDispute: {
      findUnique: vi.fn(),
      create: vi.fn(async (args: any) => ({
        id: "pds_db_001",
        publicReference: "pds_test_ref_123",
        history: [],
        ...args?.data,
      })),
      update: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "pds_db_001",
        history: [],
        ...args?.data,
      })),
    },
    paymentDisputeHistory: {
      create: vi.fn(async (args: any) => ({ id: "pdh_001", ...args?.data })),
    },
    wallet: {
      findUnique: vi.fn(async () => ({
        id: "wallet_platform",
        ownerType: "PLATFORM",
        ownerId: "platform",
        currency: "ZAR",
        status: "ACTIVE",
      })),
      create: vi.fn(),
    },
    ledgerAccount: {
      findUnique: vi.fn(async (args: any) => {
        if (args?.where?.walletId_purpose_currency || args?.where?.code) {
          return null;
        }
        return {
          id: args?.where?.id ?? "acc_mock",
          code: args?.where?.id ?? "ACC_MOCK",
          category: "LIABILITY",
          currency: "ZAR",
          status: "ACTIVE",
          allowNegative: true,
          currentBalance: new Prisma.Decimal("50000.00"),
          debitTotal: new Prisma.Decimal("0.00"),
          creditTotal: new Prisma.Decimal("50000.00"),
          version: 1,
          wallet: { id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
        };
      }),
      findMany: vi.fn(async (args: any) => {
        const ids = args?.where?.id?.in ?? ["acc_cust_held", "acc_disp_held"];
        return ids.map((id: string) => ({
          id,
          category: "LIABILITY",
          currency: "ZAR",
          status: "ACTIVE",
          allowNegative: true,
          currentBalance: new Prisma.Decimal("50000.00"),
          debitTotal: new Prisma.Decimal("0.00"),
          creditTotal: new Prisma.Decimal("50000.00"),
          version: 1,
          wallet: { id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
        }));
      }),
      create: vi.fn(async (args: any) => ({
        id: `acc_${args?.data?.code}`,
        category: args?.data?.category,
        currency: "ZAR",
        status: "ACTIVE",
        allowNegative: true,
        currentBalance: new Prisma.Decimal("50000.00"),
        debitTotal: new Prisma.Decimal("0.00"),
        creditTotal: new Prisma.Decimal("50000.00"),
        version: 1,
        wallet: { id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
        ...args?.data,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    ledgerJournal: {
      findUnique: vi.fn(async (args: any) => {
        if (args?.where?.idempotencyKey) return null;
        return {
          id: args?.where?.id ?? "jnl_dispute_001",
          reference: "JNL-DISP-001",
          journalType: { code: "GENERAL" },
          currency: "ZAR",
          actorUserId: null,
          actorType: "SYSTEM",
          idempotencyKey: "idem_key",
          sourceReference: "src_ref",
          correlationId: "corr_id",
          memo: "memo",
          metadata: {},
          policyVersion: 1,
          totalDebits: new Prisma.Decimal("500.00"),
          totalCredits: new Prisma.Decimal("500.00"),
          originalJournal: null,
          reversalJournal: null,
          postedAt: new Date(),
          createdAt: new Date(),
          entries: [],
        };
      }),
      create: vi.fn(async (args: any) => ({
        id: "jnl_dispute_001",
        reference: "JNL-DISP-001",
        ...args?.data,
      })),
    },
    ledgerEntry: {
      createMany: vi.fn(async () => ({ count: 2 })),
    },
  };
  return { prisma: mockPrisma };
});

describe("Phase 1: Payment Disputes & Chargeback Accounting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Evidence Sanitization (PII / PCI-DSS compliance)", () => {
    it("redacts credit card PANs, CVVs, PINs, passwords, and account numbers", () => {
      const sensitiveEvidence = {
        customer_name: "John Doe",
        pan: "4111111111111111",
        card_number: "4111-2222-3333-4444",
        cvv: "123",
        pin: "9999",
        account_number: "9876543210",
        nested_bank_details: {
          bank_account: "0123456789",
          routing_number: "051001",
        },
        legitimate_reason: "Customer claims item never arrived",
      };

      const sanitized = sanitizeEvidenceSnapshot(sensitiveEvidence);

      expect(sanitized).toEqual({
        customer_name: "John Doe",
        pan: "[REDACTED]",
        card_number: "[REDACTED]",
        cvv: "[REDACTED]",
        pin: "[REDACTED]",
        account_number: "[REDACTED]",
        nested_bank_details: {
          bank_account: "[REDACTED]",
          routing_number: "051001",
        },
        legitimate_reason: "Customer claims item never arrived",
      });
    });

    it("returns null when evidence is missing or not an object", () => {
      expect(sanitizeEvidenceSnapshot(null)).toBeNull();
      expect(sanitizeEvidenceSnapshot(undefined)).toBeNull();
    });
  });

  describe("openPaymentDispute Boundary", () => {
    it("posts hold journal on customer funds, creates dispute record, and flags payment reconciliation", async () => {
      const mockPayment = {
        id: "pay_001",
        publicReference: "PAY-001",
        provider: "PAYSTACK",
        amount: new Prisma.Decimal("600.00"),
        currency: "ZAR",
      };

      (prisma.payment.findUnique as any).mockResolvedValue(mockPayment);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      const result = await openPaymentDispute({
        paymentPublicReference: "PAY-001",
        providerDisputeId: "disp_pstk_987",
        amount: "600.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        providerStatus: "pending",
        evidenceDueBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        safeEvidence: {
          note: "Cardholder states transaction was unauthorized",
          card_number: "4000123456789010",
        },
      });

      expect(prisma.ledgerJournal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: "ZAR",
            type: "GENERAL",
          }),
        }),
      );

      expect(prisma.ledgerEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              direction: "DEBIT",
              lineCode: "CUSTOMER_FUNDS_DISPUTE_RESERVE",
            }),
            expect.objectContaining({
              direction: "CREDIT",
              lineCode: "DISPUTE_HELD_LIABILITY",
            }),
          ]),
        }),
      );

      expect(prisma.paymentDispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerDisputeId: "disp_pstk_987",
            status: "OPEN",
            reason: "FRAUDULENT",
            safeEvidenceSnapshot: expect.objectContaining({
              card_number: "[REDACTED]",
              note: "Cardholder states transaction was unauthorized",
            }),
          }),
        }),
      );

      // Payment reconciliation flag set
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pay_001" },
          data: { reconciliationStatus: "REQUIRED" },
        }),
      );

      expect(result.status).toBe("OPEN");
    });

    it("fails closed on non-positive dispute amount", async () => {
      await expect(
        openPaymentDispute({
          paymentPublicReference: "PAY-001",
          amount: "-50.00",
        }),
      ).rejects.toThrow("Dispute amount must be a positive number.");
    });
  });

  describe("updatePaymentDisputeEvidence Boundary", () => {
    it("sanitizes evidence and transitions OPEN dispute to UNDER_REVIEW", async () => {
      const mockDispute = {
        id: "pds_001",
        publicReference: "pds_test_ref",
        status: "OPEN",
        providerStatus: "pending",
        evidenceDueBy: null,
      };

      (prisma.paymentDispute.findUnique as any).mockResolvedValue(mockDispute);

      const result = await updatePaymentDisputeEvidence({
        disputePublicReference: "pds_test_ref",
        safeEvidence: {
          proof_of_delivery_signature: "image_base64_hash",
          cvv: "888",
        },
        providerStatus: "under_review",
      });

      expect(prisma.paymentDispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pds_001" },
          data: expect.objectContaining({
            status: "UNDER_REVIEW",
            providerStatus: "under_review",
            safeEvidenceSnapshot: {
              proof_of_delivery_signature: "image_base64_hash",
              cvv: "[REDACTED]",
            },
          }),
        }),
      );

      expect(result.status).toBe("UNDER_REVIEW");
    });
  });

  describe("resolvePaymentDispute Boundary", () => {
    it("releases dispute reserve back to customer funds when WON", async () => {
      const mockDispute = {
        id: "pds_won",
        publicReference: "pds_won_ref",
        status: "UNDER_REVIEW",
        amount: new Prisma.Decimal("450.00"),
        providerDisputeId: "disp_won_123",
        payment: { id: "pay_won" },
      };

      (prisma.paymentDispute.findUnique as any).mockResolvedValue(mockDispute);

      const result = await resolvePaymentDispute({
        disputePublicReference: "pds_won_ref",
        resolution: "WON",
        providerStatus: "resolved_won",
      });

      // Symmetrical release journal
      expect(prisma.ledgerJournal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: "ZAR",
            type: "GENERAL",
          }),
        }),
      );

      expect(prisma.ledgerEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              direction: "DEBIT",
              lineCode: "DISPUTE_HELD_RELEASED",
            }),
            expect.objectContaining({
              direction: "CREDIT",
              lineCode: "CUSTOMER_FUNDS_RESTORED",
            }),
          ]),
        }),
      );

      expect(prisma.paymentDispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pds_won" },
          data: expect.objectContaining({
            status: "WON",
            lossLedgerJournalId: null,
          }),
        }),
      );

      expect(result.status).toBe("WON");
    });

    it("clears dispute reserve and debits provider cash clearing when LOST (chargeback recognized)", async () => {
      const mockDispute = {
        id: "pds_lost",
        publicReference: "pds_lost_ref",
        status: "UNDER_REVIEW",
        amount: new Prisma.Decimal("850.00"),
        providerDisputeId: "disp_lost_999",
        payment: { id: "pay_lost" },
      };

      (prisma.paymentDispute.findUnique as any).mockResolvedValue(mockDispute);

      const result = await resolvePaymentDispute({
        disputePublicReference: "pds_lost_ref",
        resolution: "LOST",
        providerStatus: "resolved_lost",
      });

      // Provider chargeback settlement journal
      expect(prisma.ledgerJournal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: "ZAR",
            type: "GENERAL",
          }),
        }),
      );

      expect(prisma.ledgerEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              direction: "DEBIT",
              lineCode: "DISPUTE_HELD_CLEARED",
            }),
            expect.objectContaining({
              direction: "CREDIT",
              lineCode: "PLATFORM_CASH_DEDUCTED_BY_PROVIDER",
            }),
          ]),
        }),
      );

      expect(prisma.paymentDispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pds_lost" },
          data: expect.objectContaining({
            status: "LOST",
            lossLedgerJournalId: "jnl_dispute_001",
          }),
        }),
      );

      expect(result.status).toBe("LOST");
    });
  });
});
