/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  generatePaystackTransferReference,
  initiatePaystackTransferPayout,
  handlePaystackTransferSuccess,
  handlePaystackTransferReversed,
} from "@/lib/services/paystack-transfer-execution.service";
import { setupPaystackTransferRecipient } from "@/lib/payments/providers/paystack/paystack-transfer-provider.service";
import { scanPaystackTransferReconciliation } from "@/lib/services/paystack-transfer-reconciliation.service";
import { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(async (query: any) => {
      const q = typeof query === "string" ? query : (query?.strings?.join(" ") ?? "");
      if (q.includes("LedgerAccount")) {
        const ids = Array.isArray(query?.values) && query.values.length > 0 ? query.values : ["acc_held", "acc_cash_clearing"];
        return ids.map((id: string) => ({ id }));
      }
      return [{ id: "wd_001" }];
    }),
    user: {
      findUnique: vi.fn(async () => ({ id: "user_admin", status: "ACTIVE" })),
    },
    withdrawalRequest: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "wd_001",
        status: args?.data?.status ?? "PROCESSING",
        ...args?.data,
      })),
    },
    withdrawalPayoutAttempt: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(async () => 0),
      create: vi.fn(async (args: any) => ({
        id: "wpa_001",
        publicReference: "WPA-001",
        status: "PROCESSING",
        ...args?.data,
      })),
      update: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "wpa_001",
        status: args?.data?.status ?? "PROCESSING",
        ...args?.data,
      })),
    },
    withdrawalStatusHistory: {
      create: vi.fn(async (args: any) => ({ id: "wsh_001", ...args?.data })),
    },
    withdrawalReconciliationCase: {
      findUnique: vi.fn(),
      create: vi.fn(async (args: any) => ({ id: "wrc_001", ...args?.data })),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id ?? "wrc_001", ...args?.data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    payoutDestination: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(async (args: any) => ({ id: "pdest_new", ...args?.data })),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id ?? "pdest_001", ...args?.data })),
    },
    ledgerAccount: {
      findMany: vi.fn(async (args: any) => {
        const ids = args?.where?.id?.in ?? ["acc_held", "acc_cash_clearing"];
        return ids.map((id: string) => ({
          id,
          category: "LIABILITY",
          currency: "ZAR",
          status: "ACTIVE",
          allowNegative: true,
          currentBalance: new Prisma.Decimal("10000.00"),
          debitTotal: new Prisma.Decimal("0.00"),
          creditTotal: new Prisma.Decimal("10000.00"),
          version: 1,
          wallet: { id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
        }));
      }),
      findUnique: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? args?.where?.walletId_purpose_currency?.purpose ?? "acc_cash_clearing",
        category: "ASSET",
        currency: "ZAR",
        status: "ACTIVE",
        allowNegative: true,
        currentBalance: new Prisma.Decimal("10000.00"),
        debitTotal: new Prisma.Decimal("10000.00"),
        creditTotal: new Prisma.Decimal("0.00"),
        version: 1,
        wallet: { id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    ledgerJournal: {
      findUnique: vi.fn(async (args: any) => {
        if (args?.where?.idempotencyKey) return null;
        return {
          id: args?.where?.id ?? "jnl_001",
        reference: "JNL-001",
        journalType: { code: "WITHDRAWAL_PAYOUT" },
        currency: "ZAR",
        actorUserId: "user_admin",
        actorType: "FINANCE_ADMIN",
        idempotencyKey: "idem_key",
        sourceReference: "src_ref",
        correlationId: "corr_id",
        memo: "memo",
        metadata: {},
        policyVersion: 1,
        totalDebits: new Prisma.Decimal("1200.00"),
        totalCredits: new Prisma.Decimal("1200.00"),
        originalJournal: null,
        reversalJournal: null,
        postedAt: new Date(),
        createdAt: new Date(),
        entries: [
          {
            id: "entry_1",
            sequence: 1,
            accountId: "acc_held",
            account: { code: "ACC_HELD", purpose: "WITHDRAWAL_HELD", category: "LIABILITY" },
            direction: "DEBIT",
            amount: new Prisma.Decimal("1200.00"),
            lineCode: "WITHDRAWAL_SETTLE",
            memo: "Debit held",
            createdAt: new Date(),
          },
          {
            id: "entry_2",
            sequence: 2,
            accountId: "acc_cash_clearing",
            account: { code: "ACC_CASH", purpose: "CASH_CLEARING", category: "ASSET" },
            direction: "CREDIT",
            amount: new Prisma.Decimal("1200.00"),
            lineCode: "WITHDRAWAL_SETTLE",
            memo: "Credit cash clearing",
            createdAt: new Date(),
          },
        ],
      };
    }),
      create: vi.fn(async (args: any) => ({ id: "jnl_001", reference: "JNL-001", ...args?.data })),
    },
    ledgerEntry: {
      createMany: vi.fn(async () => ({ count: 2 })),
    },
    wallet: {
      findUnique: vi.fn(async () => ({ id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" })),
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe("Phase 1: Paystack Automated Transfers & Dual-Control Ledger Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Transfer Reference Construction", () => {
    it("generates compliant Paystack transfer references (kt_wpa_<random>)", () => {
      const ref = generatePaystackTransferReference();
      expect(ref).toMatch(/^kt_wpa_[a-z0-9_]{16,40}$/);
      expect(ref.length).toBeGreaterThanOrEqual(16);
      expect(ref.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Payout Destination Management", () => {
    it("masks account numbers, hashes fingerprints, and validates with Paystack", async () => {
      const mockClient: any = {
        validateAccount: vi.fn(async () => ({ verified: true })),
        createTransferRecipient: vi.fn(async () => ({
          recipient_code: "RCP_test_12345",
          details: { bank_name: "Standard Bank" },
        })),
      };

      (prisma.payoutDestination.findFirst as any).mockResolvedValue(null);
      (prisma.payoutDestination.create as any).mockImplementation((args: any) => ({
        id: "pdest_new",
        ...args.data,
      }));

      const result = await setupPaystackTransferRecipient({
        walletId: "wallet_001",
        ownerType: "STORE",
        ownerId: "store_001",
        accountName: "Acme Logistics Pty Ltd",
        accountNumber: "1234567890",
        bankCode: "051001",
        accountType: "personal",
        documentType: "identityNumber",
        documentNumber: "9001015009087",
        clientOverride: mockClient as unknown as PaystackClient,
      });

      expect(result.recipientCode).toBe("RCP_test_12345");
      expect(result.payoutDestination!.accountLast4).toBe("7890");
      expect(result.payoutDestination!.maskedLabel).toContain("7890");
      expect(result.payoutDestination!.status).toBe("ACTIVE");
      expect(result.payoutDestination!.accountFingerprint).toBeDefined();
    });

    it("archives old payout destination without in-place mutation when destination changes", async () => {
      const mockClient: any = {
        validateAccount: vi.fn(async () => ({ verified: false })),
        createTransferRecipient: vi.fn(async () => ({
          recipient_code: "RCP_new_999",
          details: { bank_name: "Nedbank" },
        })),
      };

      (prisma.payoutDestination.findFirst as any).mockResolvedValue({
        id: "pdest_old_active",
        status: "ACTIVE",
      });
      (prisma.payoutDestination.update as any).mockResolvedValue({
        id: "pdest_old_active",
        status: "REVOKED",
      });
      (prisma.payoutDestination.create as any).mockImplementation((args: any) => ({
        id: "pdest_new_dest",
        ...args.data,
      }));

      const result = await setupPaystackTransferRecipient({
        walletId: "wallet_001",
        ownerType: "STORE",
        ownerId: "store_001",
        accountName: "New Account Name",
        accountNumber: "9876543210",
        bankCode: "198765",
        clientOverride: mockClient as unknown as PaystackClient,
      });

      // Old destination was revoked
      expect(prisma.payoutDestination.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pdest_old_active" },
          data: expect.objectContaining({ status: "REVOKED" }),
        }),
      );

      // Unverified account falls closed to PENDING_REVIEW
      expect(result.payoutDestination!.status).toBe("PENDING_REVIEW");
    });
  });

  describe("Transfer Payout Initiation Boundary", () => {
    it("creates DB attempt record first with kt_wpa_ reference before provider call", async () => {
      const mockWithdrawal = {
        id: "wd_001",
        publicReference: "WTH-001",
        status: "APPROVED",
        amount: new Prisma.Decimal("500.00"),
        currency: "ZAR",
        requestedByUserId: "user_req",
        approvedByUserId: "user_app",
        latestAttemptNumber: 0,
        payoutDestination: {
          method: "PAYSTACK_TRANSFER",
          status: "ACTIVE",
          externalReference: "RCP_valid_code",
          currency: "ZAR",
        },
      };

      (prisma.withdrawalRequest.findUnique as any).mockResolvedValue(mockWithdrawal);
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockImplementation((args: any) => {
        if (args.where?.idempotencyKey) return null;
        return {
          id: "wpa_001",
          status: "PROCESSING",
          transferCode: "TRF_999",
        };
      });
      (prisma.withdrawalPayoutAttempt.create as any).mockResolvedValue({
        id: "wpa_001",
        publicReference: "WPA-001",
        status: "PROCESSING",
        attemptNumber: 1,
      });

      const mockClient: any = {
        initiateTransfer: vi.fn(async () => ({
          status: "success",
          transfer_code: "TRF_999",
        })),
      };

      const result = await initiatePaystackTransferPayout({
        actorUserId: "user_admin_exec",
        publicReference: "WTH-001",
        operationId: "op-initiate-payout-12345",
        clientOverride: mockClient as unknown as PaystackClient,
      });

      expect(prisma.withdrawalPayoutAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "PROCESSING",
            externalReference: expect.stringMatching(/^kt_wpa_/),
          }),
        }),
      );
      expect(mockClient.initiateTransfer).toHaveBeenCalled();
      expect(result?.status).toBe("PROCESSING");
    });

    it("marks attempt as UNKNOWN and opens reconciliation case on provider timeout", async () => {
      const mockWithdrawal = {
        id: "wd_timeout",
        publicReference: "WTH-TIMEOUT",
        status: "APPROVED",
        amount: new Prisma.Decimal("750.00"),
        currency: "ZAR",
        requestedByUserId: "user_req",
        approvedByUserId: "user_app",
        latestAttemptNumber: 0,
        payoutDestination: {
          method: "PAYSTACK_TRANSFER",
          status: "ACTIVE",
          externalReference: "RCP_code",
          currency: "ZAR",
        },
      };

      (prisma.withdrawalRequest.findUnique as any).mockResolvedValue(mockWithdrawal);
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockImplementation((args: any) => {
        if (args.where?.idempotencyKey) return null;
        return {
          id: "wpa_timeout",
          publicReference: "WPA-TIMEOUT",
          status: "PROCESSING",
        };
      });
      (prisma.withdrawalPayoutAttempt.create as any).mockResolvedValue({
        id: "wpa_timeout",
        publicReference: "WPA-TIMEOUT",
        status: "PROCESSING",
      });

      const mockClient: any = {
        initiateTransfer: vi.fn().mockRejectedValue(new Error("Timeout waiting for Paystack")),
      };

      await initiatePaystackTransferPayout({
        actorUserId: "user_admin_exec",
        publicReference: "WTH-TIMEOUT",
        operationId: "op-timeout-payout-12345",
        clientOverride: mockClient as unknown as PaystackClient,
      });

      // Status transitioned to UNKNOWN, withdrawal moved to RECONCILIATION_REQUIRED
      expect(prisma.withdrawalPayoutAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wpa_timeout" },
          data: expect.objectContaining({ status: "UNKNOWN" }),
        }),
      );
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_timeout" },
          data: expect.objectContaining({ status: "RECONCILIATION_REQUIRED" }),
        }),
      );
      expect(prisma.withdrawalReconciliationCase.create).toHaveBeenCalled();
    });
  });

  describe("Transfer Lifecycle & Settlement", () => {
    it("settles withdrawal atomically on transfer.success with balanced ledger posting", async () => {
      const mockAttempt = {
        id: "wpa_succ",
        publicReference: "WPA-SUCC",
        status: "PROCESSING",
        transferCode: "TRF_SUCCESS_1",
        externalReference: "kt_wpa_success_ref",
        initiatedByUserId: "user_admin",
        withdrawal: {
          id: "wd_succ",
          publicReference: "WTH-SUCC",
          status: "PROCESSING",
          amount: new Prisma.Decimal("1200.00"),
          currency: "ZAR",
          sourceAccountId: "acc_source",
          heldAccountId: "acc_held",
          ownerType: "STORE",
          policyVersion: 1,
          payoutDestination: {
            publicReference: "PD-001",
            externalReference: "RCP_MATCH",
          },
        },
      };

      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(mockAttempt);
      (prisma.wallet.findUnique as any).mockResolvedValue({ id: "wallet_platform" });
      (prisma.ledgerAccount.findUnique as any).mockResolvedValue({ id: "acc_cash_clearing" });
      (prisma.ledgerJournal.create as any).mockResolvedValue({ id: "jnl_settle", reference: "JNL-SETTLE" });
      (prisma.withdrawalRequest.update as any).mockResolvedValue({
        id: "wd_succ",
        status: "PAID",
      });

      const result = await handlePaystackTransferSuccess({
        merchantReference: "kt_wpa_success_ref",
        transferCode: "TRF_SUCCESS_1",
        amountCents: 120000,
        currency: "ZAR",
        recipientCode: "RCP_MATCH",
      });

      expect(result.outcome).toBe("APPLIED");
      expect(prisma.withdrawalPayoutAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "SUCCEEDED" }),
        }),
      );
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PAID" }),
        }),
      );
    });

    it("restores held liability and flags RECONCILIATION_REQUIRED on transfer reversal", async () => {
      const mockAttempt = {
        id: "wpa_rev",
        publicReference: "WPA-REV",
        status: "SUCCEEDED",
        transferCode: "TRF_REV",
        externalReference: "kt_wpa_rev_ref",
        withdrawal: {
          id: "wd_rev",
          publicReference: "WTH-REV",
          status: "PAID",
          amount: new Prisma.Decimal("450.00"),
          currency: "ZAR",
          heldAccountId: "acc_held_liability",
        },
      };

      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(mockAttempt);
      (prisma.wallet.findUnique as any).mockResolvedValue({ id: "wallet_platform" });
      (prisma.ledgerAccount.findUnique as any).mockResolvedValue({ id: "acc_cash_clearing" });
      (prisma.ledgerJournal.create as any).mockResolvedValue({ id: "jnl_rev", reference: "JNL-REV" });

      const result = await handlePaystackTransferReversed({
        merchantReference: "kt_wpa_rev_ref",
        transferCode: "TRF_REV",
        reason: "Destination bank rejected credit post-settlement",
      });

      expect(result.outcome).toBe("APPLIED");
      // Must not restore to wallet available without finance review; must require reconciliation
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_rev" },
          data: expect.objectContaining({ status: "RECONCILIATION_REQUIRED" }),
        }),
      );
      expect(prisma.withdrawalReconciliationCase.create).toHaveBeenCalled();
    });
  });

  describe("Scheduled Transfer Reconciliation Scanner", () => {
    it("scans and resolves stale processing attempts", async () => {
      const staleAttempt = {
        id: "wpa_stale",
        publicReference: "WPA-STALE",
        status: "PROCESSING",
        transferCode: "TRF_STALE",
        externalReference: "kt_wpa_stale_123",
        initiatedByUserId: "user_admin",
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 mins ago
        withdrawal: {
          id: "wd_stale",
          publicReference: "WTH-STALE",
          status: "PROCESSING",
          amount: new Prisma.Decimal("300.00"),
          currency: "ZAR",
          sourceAccountId: "acc_source",
          heldAccountId: "acc_held",
          ownerType: "STORE",
          policyVersion: 1,
          payoutDestination: {
            publicReference: "PD-STALE",
            externalReference: "RCP_STALE",
          },
        },
      };

      (prisma.withdrawalPayoutAttempt.findMany as any).mockResolvedValue([staleAttempt]);
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(staleAttempt);
      (prisma.wallet.findUnique as any).mockResolvedValue({ id: "wallet_platform" });
      (prisma.ledgerAccount.findUnique as any).mockResolvedValue({ id: "acc_cash" });
      (prisma.ledgerJournal.create as any).mockResolvedValue({ id: "jnl_stale_settle", reference: "JNL-001" });
      (prisma.withdrawalRequest.update as any).mockResolvedValue({ status: "PAID" });

      const mockClient: any = {
        verifyTransfer: vi.fn(async () => ({
          status: "success",
          amount: 30000,
          currency: "ZAR",
          transfer_code: "TRF_STALE",
          recipient: { recipient_code: "RCP_STALE" },
        })),
      };

      const result = await scanPaystackTransferReconciliation({
        clientOverride: mockClient as unknown as PaystackClient,
      });

      expect(result.itemsExamined).toBe(1);
      expect(result.itemsSucceeded).toBe(1);
      expect(mockClient.verifyTransfer).toHaveBeenCalledWith("kt_wpa_stale_123");
    });
  });
});
