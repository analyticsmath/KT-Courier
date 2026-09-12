/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  generatePaystackTransferReference,
  initiatePaystackTransferPayout,
  handlePaystackTransferSuccess,
  handlePaystackTransferReversed,
  handlePaystackTransferFailed,
  handlePaystackTransferBlockedOrAbandoned,
  finalizePaystackTransferOtp,
} from "@/lib/services/paystack-transfer-execution.service";
import { setupPaystackTransferRecipient } from "@/lib/payments/providers/paystack/paystack-transfer-provider.service";
import { scanPaystackTransferReconciliation } from "@/lib/services/paystack-transfer-reconciliation.service";
import {
  startWithdrawalPayout,
  completeManualWithdrawalPayout,
} from "@/lib/services/withdrawal-payout.service";
import { WithdrawalError } from "@/lib/withdrawals/errors";
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
      createMany: vi.fn(async () => ({ count: 2 })),
      count: vi.fn(async () => 0),
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

  describe("Blocker 4: Paystack Transfer OTP, Blocked, Abandoned & Manual Fallback Closure", () => {
    const baseAttempt = {
      id: "wpa_otp_001",
      withdrawalId: "wd_otp_001",
      publicReference: "WPA-OTP-001",
      status: "PROCESSING",
      method: "PAYSTACK_TRANSFER",
      transferCode: "TRF_OTP_CODE",
      externalReference: "kt_wpa_otp_test_ref",
      initiatedByUserId: "user_finance",
      createdAt: new Date(),
      withdrawal: {
        id: "wd_otp_001",
        publicReference: "WTH-OTP-001",
        withdrawalNumber: "WTH-OTP-001",
        status: "PROCESSING",
        amount: new Prisma.Decimal("500.00"),
        currency: "ZAR",
        requestedByUserId: "user_req",
        approvedByUserId: "user_app",
        sourceAccountId: "acc_source",
        heldAccountId: "acc_held",
        ownerType: "STORE",
        policyVersion: 1,
        latestAttemptNumber: 1,
        currentPayoutAttemptId: "wpa_otp_001",
        payoutDestination: {
          publicReference: "PD-001",
          externalReference: "RCP_001",
          status: "ACTIVE",
        },
      },
    };

    it("finalizes OTP successfully and audits attempt without logging or storing OTP", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: "user_finance", status: "ACTIVE" });
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(baseAttempt);
      (prisma.withdrawalStatusHistory.count as any).mockResolvedValue(0);

      const mockClient: any = {
        finalizeTransfer: vi.fn(async () => ({
          status: "success",
          transfer_code: "TRF_OTP_CODE",
          amount: 50000,
        })),
      };

      const result = await finalizePaystackTransferOtp({
        actorUserId: "user_finance",
        merchantReference: "kt_wpa_otp_test_ref",
        otp: "123456",
        clientOverride: mockClient as unknown as PaystackClient,
      });

      expect(result.outcome).toBe("SUCCESS");
      expect(mockClient.finalizeTransfer).toHaveBeenCalledWith({
        transfer_code: "TRF_OTP_CODE",
        otp: "123456",
      });

      // Audit entry must be created with reasonCode OTP_FINALIZATION_ATTEMPTED
      expect(prisma.withdrawalStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reasonCode: "OTP_FINALIZATION_ATTEMPTED",
            actorUserId: "user_finance",
          }),
        }),
      );

      // Verify OTP is NEVER stored in database audit history
      const createCall = (prisma.withdrawalStatusHistory.create as any).mock.calls[0][0];
      const serializedAudit = JSON.stringify(createCall);
      expect(serializedAudit).not.toContain("123456");
    });

    it("returns FAILED outcome on explicit invalid OTP provider response", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: "user_finance", status: "ACTIVE" });
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(baseAttempt);
      (prisma.withdrawalStatusHistory.count as any).mockResolvedValue(1);

      const mockClient: any = {
        finalizeTransfer: vi.fn(async () => {
          throw new Error("Invalid OTP entered");
        }),
      };

      const result = await finalizePaystackTransferOtp({
        actorUserId: "user_finance",
        merchantReference: "kt_wpa_otp_test_ref",
        otp: "999999",
        clientOverride: mockClient as unknown as PaystackClient,
      });

      expect(result.outcome).toBe("FAILED");
      expect(result.message).toContain("Invalid OTP entered");
    });

    it("transitions to UNKNOWN and opens reconciliation case on OTP timeout / network error", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: "user_finance", status: "ACTIVE" });
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(baseAttempt);
      (prisma.withdrawalStatusHistory.count as any).mockResolvedValue(0);

      const mockClient: any = {
        finalizeTransfer: vi.fn(async () => {
          const timeoutErr = new Error("Gateway timeout");
          timeoutErr.name = "AbortError";
          throw timeoutErr;
        }),
      };

      const result = await finalizePaystackTransferOtp({
        actorUserId: "user_finance",
        merchantReference: "kt_wpa_otp_test_ref",
        otp: "123456",
        clientOverride: mockClient as unknown as PaystackClient,
      });

      expect(result.outcome).toBe("UNKNOWN");
      expect(prisma.withdrawalPayoutAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wpa_otp_001" },
          data: expect.objectContaining({
            status: "UNKNOWN",
            failureCode: "OTP_FINALIZATION_TIMEOUT",
          }),
        }),
      );
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_otp_001" },
          data: expect.objectContaining({
            status: "RECONCILIATION_REQUIRED",
          }),
        }),
      );
      expect(prisma.withdrawalReconciliationCase.create).toHaveBeenCalled();
    });

    it("enforces rate limit of maximum 3 OTP attempts", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: "user_finance", status: "ACTIVE" });
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(baseAttempt);
      (prisma.withdrawalStatusHistory.count as any).mockResolvedValue(3); // Already 3 prior attempts

      const mockClient: any = { finalizeTransfer: vi.fn() };

      await expect(
        finalizePaystackTransferOtp({
          actorUserId: "user_finance",
          merchantReference: "kt_wpa_otp_test_ref",
          otp: "123456",
          clientOverride: mockClient as unknown as PaystackClient,
        }),
      ).rejects.toThrowError(WithdrawalError);

      expect(mockClient.finalizeTransfer).not.toHaveBeenCalled();
    });

    it("handles blocked transfer by transitioning to RECONCILIATION_REQUIRED and preserving held funds", async () => {
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(baseAttempt);

      const result = await handlePaystackTransferBlockedOrAbandoned({
        merchantReference: "kt_wpa_otp_test_ref",
        transferCode: "TRF_BLOCKED",
        status: "blocked",
        reason: "Compliance account check blocked transfer",
      });

      expect(result.outcome).toBe("APPLIED");
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_otp_001" },
          data: expect.objectContaining({ status: "RECONCILIATION_REQUIRED" }),
        }),
      );
      expect(prisma.withdrawalPayoutAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wpa_otp_001" },
          data: expect.objectContaining({
            status: "UNKNOWN",
            failureCode: "PAYSTACK_TRANSFER_BLOCKED",
          }),
        }),
      );
      expect(prisma.withdrawalReconciliationCase.create).toHaveBeenCalled();
    });

    it("handles abandoned transfer by transitioning to RECONCILIATION_REQUIRED and preserving held funds", async () => {
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(baseAttempt);

      const result = await handlePaystackTransferBlockedOrAbandoned({
        merchantReference: "kt_wpa_otp_test_ref",
        transferCode: "TRF_ABANDONED",
        status: "abandoned",
        reason: "User abandoned OTP session",
      });

      expect(result.outcome).toBe("APPLIED");
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_otp_001" },
          data: expect.objectContaining({ status: "RECONCILIATION_REQUIRED" }),
        }),
      );
      expect(prisma.withdrawalPayoutAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wpa_otp_001" },
          data: expect.objectContaining({
            status: "UNKNOWN",
            failureCode: "PAYSTACK_TRANSFER_ABANDONED",
          }),
        }),
      );
    });

    it("handles rejected transfer as definitive failure, returning withdrawal to APPROVED for retry", async () => {
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(baseAttempt);

      const result = await handlePaystackTransferFailed({
        merchantReference: "kt_wpa_otp_test_ref",
        transferCode: "TRF_REJECTED",
        failureMessage: "Bank account resolved invalid by provider",
      });

      expect(result.outcome).toBe("APPLIED");
      expect(prisma.withdrawalPayoutAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wpa_otp_001" },
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_otp_001" },
          data: expect.objectContaining({ status: "APPROVED", currentPayoutAttemptId: null }),
        }),
      );
    });

    it("cancels withdrawal and releases reservation on transfer.failed webhook when unresolved in-flight disputes exist", async () => {
      const attemptWithDispute = {
        ...baseAttempt,
        withdrawal: {
          ...baseAttempt.withdrawal,
          walletId: "wallet_store_001",
        },
      };
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(attemptWithDispute);
      (prisma.ledgerAccount.findMany as any).mockResolvedValue([
        {
          id: "acc_source",
          walletId: "wallet_store_001",
          purpose: "OWNER_WITHDRAWABLE",
          category: "LIABILITY",
          currency: "ZAR",
          status: "ACTIVE",
          allowNegative: false,
          currentBalance: new Prisma.Decimal("10000.00"),
          debitTotal: new Prisma.Decimal("0.00"),
          creditTotal: new Prisma.Decimal("10000.00"),
          version: 1,
          wallet: { id: "wallet_store_001", ownerType: "STORE", ownerId: "store_001", currency: "ZAR", status: "ACTIVE" },
        },
        {
          id: "acc_held",
          walletId: "wallet_store_001",
          purpose: "WITHDRAWAL_HELD",
          category: "LIABILITY",
          currency: "ZAR",
          status: "ACTIVE",
          allowNegative: false,
          currentBalance: new Prisma.Decimal("10000.00"),
          debitTotal: new Prisma.Decimal("0.00"),
          creditTotal: new Prisma.Decimal("10000.00"),
          version: 1,
          wallet: { id: "wallet_store_001", ownerType: "STORE", ownerId: "store_001", currency: "ZAR", status: "ACTIVE" },
        },
      ]);
      (prisma as any).store = {
        findUnique: vi.fn(async () => ({ id: "store_001", status: "ACTIVE" })),
      };
      (prisma as any).paymentDisputeAllocation = {
        findMany: vi.fn(async () => [
          {
            id: "pda_disp_fail",
            publicReference: "PDA-DISP-FAIL",
            holdingState: "IN_FLIGHT_HOLD",
            allocatedAmount: new Prisma.Decimal("200.00"),
            settledAt: null,
            dispute: { id: "disp_1", status: "OPEN", amount: new Prisma.Decimal("200.00"), allocations: [] },
          },
        ]),
        update: vi.fn(async () => ({ id: "pda_disp_fail" })),
      };
      (prisma as any).withdrawalEarningAllocation = {
        updateMany: vi.fn(async () => ({ count: 1 })),
      };
      (prisma as any).paymentDispute = {
        findUnique: vi.fn(async () => ({ id: "disp_1", status: "OPEN", amount: new Prisma.Decimal("200.00"), allocations: [] })),
        update: vi.fn(async () => ({ id: "disp_1" })),
      };

      const result = await handlePaystackTransferFailed({
        merchantReference: "kt_wpa_otp_test_ref",
        transferCode: "TRF_REJECTED",
        failureMessage: "Bank account resolved invalid by provider",
      });

      expect(result.outcome).toBe("APPLIED");
      expect(prisma.withdrawalPayoutAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wpa_otp_001" },
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_otp_001" },
          data: expect.objectContaining({
            status: "CANCELLED",
            cancellationReasonCode: "PAYOUT_FAILED_WITH_DISPUTE",
          }),
        }),
      );
      expect((prisma as any).withdrawalEarningAllocation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { withdrawalRequestId: "wd_otp_001", status: "RESERVED" },
          data: { status: "CANCELLED" },
        }),
      );

      delete (prisma as any).paymentDisputeAllocation;
      delete (prisma as any).withdrawalEarningAllocation;
      delete (prisma as any).paymentDispute;
      delete (prisma as any).store;
    });

    it("strictly rejects manual completion fallback for automated PAYSTACK_TRANSFER attempts while outcome is UNKNOWN or processing", async () => {
      const unknownAttempt = {
        ...baseAttempt,
        status: "UNKNOWN",
        method: "PAYSTACK_TRANSFER",
        withdrawal: {
          ...baseAttempt.withdrawal,
          status: "RECONCILIATION_REQUIRED",
        },
      };

      (prisma.withdrawalRequest.findUnique as any).mockResolvedValue(unknownAttempt.withdrawal);
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue(unknownAttempt);

      await expect(
        completeManualWithdrawalPayout({
          actorUserId: "user_finance_other",
          withdrawalPublicReference: "WTH-OTP-001",
          payoutAttemptPublicReference: "WPA-OTP-001",
          externalPayoutReference: "manual-bank:REF-9999",
          operationId: "op-manual-fallback-fail",
        }),
      ).rejects.toThrowError(/Automated transfer attempts cannot use manual fallback/);
    });

    it("strictly rejects starting a new manual payout when an attempt is in UNKNOWN status", async () => {
      (prisma.withdrawalRequest.findUnique as any).mockResolvedValue({
        ...baseAttempt.withdrawal,
        status: "RECONCILIATION_REQUIRED",
      });

      await expect(
        startWithdrawalPayout({
          actorUserId: "user_finance_new",
          publicReference: "WTH-OTP-001",
          operationId: "op-start-manual-when-unknown",
        }),
      ).rejects.toThrowError(/Only approved withdrawals can start payout processing/);
    });
  });
});
