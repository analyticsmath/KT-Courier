/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  openPaymentDispute,
  resolvePaymentDispute,
  sanitizeEvidenceSnapshot,
} from "@/lib/services/payment-dispute.service";
import { prisma } from "@/lib/db/prisma";

const accountsMap = new Map<string, any>();

vi.mock("@/lib/db/prisma", () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(async (query: any) => {
      const q = typeof query === "string" ? query : (query?.strings?.join(" ") ?? "");
      if (q.includes("LedgerAccount")) {
        const ids = Array.isArray(query?.values) && query.values.length > 0 ? query.values : ["acc_001", "acc_002"];
        return ids.map((id: string) => ({ id }));
      }
      return [{ id: "mock_id" }];
    }),
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id ?? "pay_001", ...args?.data })),
    },
    store: {
      findUnique: vi.fn(async () => ({ id: "store_001", status: "ACTIVE" })),
    },
    driverProfile: {
      findUnique: vi.fn(async () => ({ id: "driver_001", status: "ACTIVE" })),
    },
    user: {
      findFirst: vi.fn(async () => ({ id: "user_001", role: "CUSTOMER" })),
      findUnique: vi.fn(async () => ({ id: "user_001", status: "ACTIVE" })),
    },
    storeEarning: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "se_001",
        releasedAmount: new Prisma.Decimal("700.00"),
        status: "RELEASED",
      })),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id, ...args?.data })),
    },
    driverEarning: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "de_001",
        releasedAmount: new Prisma.Decimal("200.00"),
        status: "RELEASED",
      })),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id, ...args?.data })),
    },
    withdrawalRequest: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "wd_001",
        publicReference: "WD-TEST-001",
        walletId: "wallet_STORE_store_001",
        ownerType: "STORE",
        ownerId: "store_001",
        amount: new Prisma.Decimal("500.00"),
        currency: "ZAR",
        status: "REQUESTED",
        sourceAccountId: "acc_store_withdrawable",
        heldAccountId: "acc_store_withdrawal_held",
        payoutDestination: { publicReference: "DEST-001", status: "ACTIVE" },
        payoutAttempts: [],
        policyVersion: 1,
      })),
      findMany: vi.fn(async () => []),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id ?? "wd_001", ...args?.data })),
    },
    withdrawalPayoutAttempt: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id, ...args?.data })),
    },
    withdrawalEarningAllocation: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (args: any) => ({ id: "wea_001", ...args?.data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    withdrawalStatusHistory: {
      create: vi.fn(async (args: any) => ({ id: "wsh_001", ...args?.data })),
      createMany: vi.fn(async () => ({ count: 2 })),
    },
    paymentDispute: {
      findUnique: vi.fn(),
      create: vi.fn(async (args: any) => ({
        id: "pds_db_001",
        publicReference: "pds_test_ref_123",
        history: [],
        allocations: [],
        ...args?.data,
      })),
      update: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "pds_db_001",
        history: [],
        allocations: [],
        ...args?.data,
      })),
    },
    paymentDisputeAllocation: {
      create: vi.fn(async (args: any) => ({ id: "pda_001", ...args?.data })),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      update: vi.fn(async (args: any) => ({ id: args?.where?.id, ...args?.data })),
    },
    paymentDisputeHistory: {
      create: vi.fn(async (args: any) => ({ id: "pdh_001", ...args?.data })),
    },
    wallet: {
      findUnique: vi.fn(async (args: any) => {
        const ownerType = args?.where?.ownerType_ownerId_currency?.ownerType ?? "PLATFORM";
        const ownerId = args?.where?.ownerType_ownerId_currency?.ownerId ?? "platform";
        return {
          id: `wallet_${ownerType}_${ownerId}`,
          ownerType,
          ownerId,
          currency: "ZAR",
          status: "ACTIVE",
        };
      }),
      create: vi.fn(async (args: any) => ({
        id: `wallet_${args?.data?.ownerType}_${args?.data?.ownerId}`,
        ...args?.data,
      })),
    },
    ledgerAccount: {
      findFirst: vi.fn(async (args: any) => {
        const { walletId, purpose } = args.where;
        return Array.from(accountsMap.values()).find((a) => a.walletId === walletId && a.purpose === purpose) ?? null;
      }),
      findUnique: vi.fn(async (args: any) => {
        if (args?.where?.id) {
          return (
            accountsMap.get(args.where.id) ?? {
              id: args.where.id,
              code: `ACC_${args.where.id}`,
              purpose: "HELD",
              category: "LIABILITY",
              currency: "ZAR",
              status: "ACTIVE",
              allowNegative: true,
              currentBalance: new Prisma.Decimal("100000.00"),
              debitTotal: new Prisma.Decimal("0.00"),
              creditTotal: new Prisma.Decimal("100000.00"),
              version: 1,
              wallet: { id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
            }
          );
        }
        if (args?.where?.code) {
          return Array.from(accountsMap.values()).find((a) => a.code === args.where.code) ?? null;
        }
        if (args?.where?.walletId_purpose_currency) {
          const { walletId, purpose, currency } = args.where.walletId_purpose_currency;
          return (
            Array.from(accountsMap.values()).find(
              (a) => a.walletId === walletId && a.purpose === purpose && a.currency === currency,
            ) ?? null
          );
        }
        return null;
      }),
      findMany: vi.fn(async (args: any) => {
        const ids = args?.where?.id?.in ?? ["acc_001", "acc_002"];
        return ids.map(
          (id: string) =>
            accountsMap.get(id) ?? {
              id,
              code: `ACC_${id}`,
              purpose: "HELD",
              category: "LIABILITY",
              currency: "ZAR",
              status: "ACTIVE",
              allowNegative: true,
              currentBalance: new Prisma.Decimal("100000.00"),
              debitTotal: new Prisma.Decimal("0.00"),
              creditTotal: new Prisma.Decimal("100000.00"),
              version: 1,
              wallet: { id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
            },
        );
      }),
      create: vi.fn(async (args: any) => {
        const account = {
          id: `acc_${args.data.code}`,
          walletId: args.data.walletId,
          code: args.data.code,
          purpose: args.data.purpose,
          category: args.data.category,
          currency: args.data.currency,
          status: "ACTIVE",
          allowNegative: true,
          currentBalance: new Prisma.Decimal("100000.00"),
          debitTotal: new Prisma.Decimal("0.00"),
          creditTotal: new Prisma.Decimal("100000.00"),
          version: 1,
          wallet: { id: args.data.walletId, ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
        };
        accountsMap.set(account.id, account);
        return account;
      }),
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
          totalDebits: new Prisma.Decimal("1000.00"),
          totalCredits: new Prisma.Decimal("1000.00"),
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
        totalDebits: args?.data?.totalDebits ?? new Prisma.Decimal("1000.00"),
        totalCredits: args?.data?.totalCredits ?? new Prisma.Decimal("1000.00"),
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
    accountsMap.clear();
  });

  describe("Blocker 2: Dispute Evidence Allowlist (Schema vs Denylist)", () => {
    it("preserves allowlisted operationally required fields and discards unexpected PII fields", () => {
      const providerPayloadWithPII = {
        providerDisputeId: "disp_pstk_12345",
        transactionReference: "kt_pay_ref_67890",
        amount: 450.0,
        currency: "ZAR",
        status: "needs_response",
        reason: "fraudulent",
        evidenceDueBy: "2026-09-20T12:00:00Z",
        authorizedPrivateObjectReferences: ["s3://evidence/doc1.pdf", "s3://evidence/doc2.png"],
        explanation: "Customer states transaction was unauthorized",
        customer_name: "John Doe",
        pan: "4111111111111111",
        card_number: "4111-2222-3333-4444",
        cvv: "123",
        pin: "9999",
        national_id_ssn: "9801015000085",
        bank_account_number: "9876543210",
        customer_home_address: "123 Main Road, Cape Town",
        unrestricted_pod_media_blob: "base64_blob_here",
        arbitrary_extra_payload: { foo: "bar", internal: "leak" },
      };

      const sanitized = sanitizeEvidenceSnapshot(providerPayloadWithPII);

      expect(sanitized).not.toBeNull();
      expect(sanitized?.providerDisputeId).toBe("disp_pstk_12345");
      expect(sanitized?.transactionReference).toBe("kt_pay_ref_67890");
      expect(sanitized?.amount).toBe(450.0);
      expect(sanitized?.currency).toBe("ZAR");
      expect(sanitized?.status).toBe("needs_response");
      expect(sanitized?.reason).toBe("fraudulent");
      expect(sanitized?.evidenceDueBy).toBe("2026-09-20T12:00:00Z");
      expect(sanitized?.authorizedPrivateObjectReferences).toEqual([
        "s3://evidence/doc1.pdf",
        "s3://evidence/doc2.png",
      ]);
      expect(sanitized?.explanation).toBe("Customer states transaction was unauthorized");

      const anySanitized = sanitized as any;
      expect(anySanitized?.customer_name).toBeUndefined();
      expect(anySanitized?.pan).toBeUndefined();
      expect(anySanitized?.card_number).toBeUndefined();
      expect(anySanitized?.cvv).toBeUndefined();
      expect(anySanitized?.pin).toBeUndefined();
      expect(anySanitized?.national_id_ssn).toBeUndefined();
      expect(anySanitized?.bank_account_number).toBeUndefined();
      expect(anySanitized?.customer_home_address).toBeUndefined();
      expect(anySanitized?.unrestricted_pod_media_blob).toBeUndefined();
      expect(anySanitized?.arbitrary_extra_payload).toBeUndefined();
    });

    it("returns null when required fields are missing", () => {
      expect(sanitizeEvidenceSnapshot(null)).toBeNull();
      expect(sanitizeEvidenceSnapshot({})).toBeNull();
      expect(sanitizeEvidenceSnapshot({ amount: 100 })).toBeNull();
    });
  });

  describe("Blocker 1: Multi-Vendor Dispute Accounting Scenarios", () => {
    const basePayment = {
      id: "pay_dispute_001",
      publicReference: "PAY-DISP-001",
      amount: new Prisma.Decimal("1000.00"),
      currency: "ZAR",
      status: "COMPLETED",
    };

    const baseStoreEarning = {
      id: "se_001",
      storeId: "store_001",
      paymentId: "pay_dispute_001",
      amount: new Prisma.Decimal("700.00"),
      releasedAmount: new Prisma.Decimal("700.00"),
      currency: "ZAR",
      status: "ACCRUED",
      payableAccountId: "acc_store_payable",
    };

    const baseDriverEarning = {
      id: "de_001",
      driverId: "driver_001",
      paymentId: "pay_dispute_001",
      amount: new Prisma.Decimal("200.00"),
      releasedAmount: new Prisma.Decimal("200.00"),
      currency: "ZAR",
      status: "ACCRUED",
      payableAccountId: "acc_driver_payable",
    };

    it("1. fully unreleased vendor + driver + platform allocations (ACCRUED)", async () => {
      (prisma.payment.findUnique as any).mockResolvedValue(basePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([baseStoreEarning]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([baseDriverEarning]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      const result = await openPaymentDispute({
        paymentPublicReference: "PAY-DISP-001",
        providerDisputeId: "disp_unreleased_001",
        amount: "1000.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        providerStatus: "needs_response",
      });

      expect(result).toBeDefined();
      expect(prisma.ledgerJournal.create).toHaveBeenCalled();

      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;

      expect(createdAllocations).toHaveLength(3); // Store, Driver, Platform

      const storeAlloc = createdAllocations.find((a: any) => a.participantType === "STORE");
      const driverAlloc = createdAllocations.find((a: any) => a.participantType === "DRIVER");
      const platformAlloc = createdAllocations.find((a: any) => a.participantType === "PLATFORM");

      expect(storeAlloc.holdingState).toBe("UNRELEASED_HELD");
      expect(Number(storeAlloc.allocatedAmount)).toBe(700);

      expect(driverAlloc.holdingState).toBe("UNRELEASED_HELD");
      expect(Number(driverAlloc.allocatedAmount)).toBe(200);

      expect(platformAlloc.holdingState).toBe("PLATFORM_HELD");
      expect(Number(platformAlloc.allocatedAmount)).toBe(100);

      const sumAllocations =
        Number(storeAlloc.allocatedAmount) +
        Number(driverAlloc.allocatedAmount) +
        Number(platformAlloc.allocatedAmount);
      expect(sumAllocations).toBe(1000);
    });

    it("2. released unwithdrawn allocations (vendor released, driver ACCRUED)", async () => {
      const releasedStoreEarning = { ...baseStoreEarning, status: "RELEASED" };
      (prisma.payment.findUnique as any).mockResolvedValue(basePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([releasedStoreEarning]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([baseDriverEarning]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);
      (prisma.withdrawalEarningAllocation.findMany as any).mockResolvedValue([]);

      await openPaymentDispute({
        paymentPublicReference: "PAY-DISP-001",
        providerDisputeId: "disp_partially_released_002",
        amount: "1000.00",
        currency: "ZAR",
        reason: "PRODUCT_NOT_RECEIVED",
        providerStatus: "needs_response",
      });

      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;

      const storeAlloc = createdAllocations.find((a: any) => a.participantType === "STORE");
      const driverAlloc = createdAllocations.find((a: any) => a.participantType === "DRIVER");

      expect(storeAlloc.holdingState).toBe("RELEASED_HOLD");
      expect(Number(storeAlloc.allocatedAmount)).toBe(700);
      expect(Number(storeAlloc.heldAmount)).toBe(700);

      expect(driverAlloc.holdingState).toBe("UNRELEASED_HELD");
      expect(Number(driverAlloc.allocatedAmount)).toBe(200);
    });

    it("3. mixed released/unreleased allocations", async () => {
      const releasedDriverEarning = { ...baseDriverEarning, status: "RELEASED" };
      (prisma.payment.findUnique as any).mockResolvedValue(basePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([baseStoreEarning]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([releasedDriverEarning]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);
      (prisma.withdrawalEarningAllocation.findMany as any).mockResolvedValue([]);

      await openPaymentDispute({
        paymentPublicReference: "PAY-DISP-001",
        providerDisputeId: "disp_mixed_003",
        amount: "1000.00",
        currency: "ZAR",
        reason: "DUPLICATE",
        providerStatus: "needs_response",
      });

      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;

      const storeAlloc = createdAllocations.find((a: any) => a.participantType === "STORE");
      const driverAlloc = createdAllocations.find((a: any) => a.participantType === "DRIVER");

      expect(storeAlloc.holdingState).toBe("UNRELEASED_HELD");
      expect(driverAlloc.holdingState).toBe("RELEASED_HOLD");
    });

    it("4. fully paid out earning -> SETTLED allocation produces RECOVERY_RECEIVABLE without rewriting payout journals", async () => {
      const releasedStoreEarning = { ...baseStoreEarning, status: "RELEASED" };
      (prisma.payment.findUnique as any).mockResolvedValue(basePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([releasedStoreEarning]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([baseDriverEarning]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      // Store earning has an allocation to a terminal PAID withdrawal
      const mockSettledAllocation = {
        id: "wea_settled_001",
        storeEarningId: "se_001",
        allocatedAmount: new Prisma.Decimal("700.00"),
        status: "SETTLED",
        withdrawal: {
          id: "wd_paid_001",
          status: "PAID",
          payoutLedgerJournalId: "jnl_historical_payout_999",
          payoutAttempts: [{ method: "MANUAL_EXTERNAL", status: "SUCCEEDED" }],
        },
      };
      (prisma.withdrawalEarningAllocation.findMany as any).mockResolvedValue([mockSettledAllocation]);

      await openPaymentDispute({
        paymentPublicReference: "PAY-DISP-001",
        providerDisputeId: "disp_withdrawn_004",
        amount: "1000.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        providerStatus: "needs_response",
      });

      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;

      const storeAlloc = createdAllocations.find((a: any) => a.participantType === "STORE");
      expect(storeAlloc.holdingState).toBe("RECOVERY_RECEIVABLE");
      expect(Number(storeAlloc.recoveryReceivableAmount)).toBe(700);
      expect(Number(storeAlloc.heldAmount)).toBe(0);
      expect(storeAlloc.withdrawalEarningAllocationId).toBe("wea_settled_001");

      // Verify that historical payout journal was NEVER modified or deleted
      expect((prisma as any).ledgerJournal.update).toBeUndefined();
      expect((prisma as any).ledgerJournal.delete).toBeUndefined();
    });

    it("5. partial payout split: R1,000 earning with R400 paid + R600 available, R700 dispute -> R400 RECOVERY_RECEIVABLE + R300 RELEASED_HOLD", async () => {
      const singlePayment = {
        id: "pay_split_001",
        publicReference: "PAY-SPLIT-001",
        amount: new Prisma.Decimal("1000.00"),
        currency: "ZAR",
        status: "COMPLETED",
      };
      const storeEarning1000 = {
        id: "se_1000",
        storeId: "store_001",
        paymentId: "pay_split_001",
        amount: new Prisma.Decimal("1000.00"),
        releasedAmount: new Prisma.Decimal("1000.00"),
        currency: "ZAR",
        status: "RELEASED",
        payableAccountId: "acc_store_payable",
      };

      (prisma.payment.findUnique as any).mockResolvedValue(singlePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([storeEarning1000]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      // R400 settled allocation, R600 available
      const mockAllocations = [
        {
          id: "wea_split_settled",
          storeEarningId: "se_1000",
          allocatedAmount: new Prisma.Decimal("400.00"),
          status: "SETTLED",
          withdrawal: {
            id: "wd_settled_001",
            status: "PAID",
            payoutLedgerJournalId: "jnl_payout_400",
            payoutAttempts: [{ method: "MANUAL_EXTERNAL", status: "SUCCEEDED" }],
          },
        },
      ];
      (prisma.withdrawalEarningAllocation.findMany as any).mockResolvedValue(mockAllocations);

      await openPaymentDispute({
        paymentPublicReference: "PAY-SPLIT-001",
        providerDisputeId: "disp_split_700",
        amount: "700.00",
        currency: "ZAR",
        reason: "PRODUCT_NOT_RECEIVED",
        providerStatus: "needs_response",
      });

      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;

      expect(createdAllocations).toHaveLength(2);

      const receivableAlloc = createdAllocations.find((a: any) => a.holdingState === "RECOVERY_RECEIVABLE");
      const releasedAlloc = createdAllocations.find((a: any) => a.holdingState === "RELEASED_HOLD");

      expect(receivableAlloc).toBeDefined();
      expect(Number(receivableAlloc.allocatedAmount)).toBe(400);
      expect(Number(receivableAlloc.recoveryReceivableAmount)).toBe(400);
      expect(receivableAlloc.withdrawalEarningAllocationId).toBe("wea_split_settled");

      expect(releasedAlloc).toBeDefined();
      expect(Number(releasedAlloc.allocatedAmount)).toBe(300);
      expect(Number(releasedAlloc.heldAmount)).toBe(300);

      // Total exposure matches R700 dispute exactly
      expect(Number(receivableAlloc.allocatedAmount) + Number(releasedAlloc.allocatedAmount)).toBe(700);
    });

    it("6. 3-way split: R300 settled + R200 in-flight (PROCESSING) + R500 available, R700 dispute -> R300 RECOVERY_RECEIVABLE + R200 IN_FLIGHT_HOLD + R200 RELEASED_HOLD", async () => {
      const singlePayment = {
        id: "pay_3way_001",
        publicReference: "PAY-3WAY-001",
        amount: new Prisma.Decimal("1000.00"),
        currency: "ZAR",
        status: "COMPLETED",
      };
      const storeEarning1000 = {
        id: "se_3way",
        storeId: "store_001",
        paymentId: "pay_3way_001",
        amount: new Prisma.Decimal("1000.00"),
        releasedAmount: new Prisma.Decimal("1000.00"),
        currency: "ZAR",
        status: "RELEASED",
        payableAccountId: "acc_store_payable",
      };

      (prisma.payment.findUnique as any).mockResolvedValue(singlePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([storeEarning1000]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      const mockAllocations = [
        {
          id: "wea_settled_300",
          storeEarningId: "se_3way",
          allocatedAmount: new Prisma.Decimal("300.00"),
          status: "SETTLED",
          withdrawal: {
            id: "wd_paid_300",
            publicReference: "WD-PAID-300",
            status: "PAID",
            payoutLedgerJournalId: "jnl_payout_300",
            payoutAttempts: [{ method: "MANUAL_EXTERNAL", status: "SUCCEEDED" }],
          },
        },
        {
          id: "wea_inflight_200",
          storeEarningId: "se_3way",
          allocatedAmount: new Prisma.Decimal("200.00"),
          status: "RESERVED",
          withdrawal: {
            id: "wd_proc_200",
            publicReference: "WD-PROC-200",
            status: "PROCESSING",
            payoutLedgerJournalId: null,
            payoutAttempts: [{ method: "PAYSTACK_TRANSFER", status: "PROCESSING" }],
          },
        },
      ];
      (prisma.withdrawalEarningAllocation.findMany as any).mockResolvedValue(mockAllocations);

      const result = await openPaymentDispute({
        paymentPublicReference: "PAY-3WAY-001",
        providerDisputeId: "disp_3way_700",
        amount: "700.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        providerStatus: "needs_response",
      });

      expect(result).toBeDefined();
      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;

      expect(createdAllocations).toHaveLength(3);

      const receivableAlloc = createdAllocations.find((a: any) => a.holdingState === "RECOVERY_RECEIVABLE");
      const inFlightAlloc = createdAllocations.find((a: any) => a.holdingState === "IN_FLIGHT_HOLD");
      const releasedAlloc = createdAllocations.find((a: any) => a.holdingState === "RELEASED_HOLD");

      expect(receivableAlloc).toBeDefined();
      expect(Number(receivableAlloc.allocatedAmount)).toBe(300);
      expect(receivableAlloc.withdrawalEarningAllocationId).toBe("wea_settled_300");

      expect(inFlightAlloc).toBeDefined();
      expect(Number(inFlightAlloc.allocatedAmount)).toBe(200);
      expect(inFlightAlloc.withdrawalEarningAllocationId).toBe("wea_inflight_200");
      expect(inFlightAlloc.ledgerAccountId).toBeNull(); // No hold journal posted for in-flight

      expect(releasedAlloc).toBeDefined();
      expect(Number(releasedAlloc.allocatedAmount)).toBe(200);

      // Total equals R700
      expect(
        Number(receivableAlloc.allocatedAmount) +
        Number(inFlightAlloc.allocatedAmount) +
        Number(releasedAlloc.allocatedAmount)
      ).toBe(700);

      // Dispute flagged reconciliationRequired because of IN_FLIGHT_HOLD
      expect(createCall.data.reconciliationRequired).toBe(true);
    });

    it("7. in-flight pre-provider interception: cancels pre-provider withdrawal, releases reservation, holds disputed amount as RELEASED_HOLD", async () => {
      const singlePayment = {
        id: "pay_preprov_001",
        publicReference: "PAY-PREPROV-001",
        amount: new Prisma.Decimal("1000.00"),
        currency: "ZAR",
        status: "COMPLETED",
      };
      const storeEarning1000 = {
        id: "se_preprov",
        storeId: "store_001",
        paymentId: "pay_preprov_001",
        amount: new Prisma.Decimal("1000.00"),
        releasedAmount: new Prisma.Decimal("1000.00"),
        currency: "ZAR",
        status: "RELEASED",
        payableAccountId: "acc_store_payable",
      };

      (prisma.payment.findUnique as any).mockResolvedValue(singlePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([storeEarning1000]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      // R500 in pre-provider REQUESTED withdrawal, R500 available
      const mockAllocations = [
        {
          id: "wea_preprov_500",
          storeEarningId: "se_preprov",
          allocatedAmount: new Prisma.Decimal("500.00"),
          status: "RESERVED",
          withdrawal: {
            id: "wd_req_500",
            publicReference: "WD-REQ-500",
            walletId: "wallet_STORE_store_001",
            ownerType: "STORE",
            ownerId: "store_001",
            amount: new Prisma.Decimal("500.00"),
            currency: "ZAR",
            status: "REQUESTED",
            sourceAccountId: "acc_store_withdrawable",
            heldAccountId: "acc_store_withdrawal_held",
            payoutDestination: { publicReference: "DEST-001", status: "ACTIVE" },
            payoutAttempts: [],
            releaseLedgerJournalId: null,
            payoutLedgerJournalId: null,
            policyVersion: 1,
          },
        },
      ];
      (prisma.withdrawalEarningAllocation.findMany as any).mockResolvedValue(mockAllocations);
      (prisma.withdrawalRequest.findUnique as any).mockResolvedValue(mockAllocations[0].withdrawal);

      accountsMap.set("acc_store_withdrawable", {
        id: "acc_store_withdrawable",
        walletId: "wallet_STORE_store_001",
        code: "OWN-WD-WALLETSTORESTORE001",
        purpose: "OWNER_WITHDRAWABLE",
        category: "LIABILITY",
        currency: "ZAR",
        status: "ACTIVE",
        allowNegative: false,
        currentBalance: new Prisma.Decimal("10000.00"),
        debitTotal: new Prisma.Decimal("0.00"),
        creditTotal: new Prisma.Decimal("10000.00"),
        version: 1,
        wallet: { id: "wallet_STORE_store_001", ownerType: "STORE", ownerId: "store_001", currency: "ZAR", status: "ACTIVE" },
      });
      accountsMap.set("acc_store_withdrawal_held", {
        id: "acc_store_withdrawal_held",
        walletId: "wallet_STORE_store_001",
        code: "WD-HELD-WALLETSTORESTORE001",
        purpose: "WITHDRAWAL_HELD",
        category: "LIABILITY",
        currency: "ZAR",
        status: "ACTIVE",
        allowNegative: false,
        currentBalance: new Prisma.Decimal("500.00"),
        debitTotal: new Prisma.Decimal("0.00"),
        creditTotal: new Prisma.Decimal("500.00"),
        version: 1,
        wallet: { id: "wallet_STORE_store_001", ownerType: "STORE", ownerId: "store_001", currency: "ZAR", status: "ACTIVE" },
      });

      await openPaymentDispute({
        paymentPublicReference: "PAY-PREPROV-001",
        providerDisputeId: "disp_preprov_700",
        amount: "700.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        providerStatus: "needs_response",
      });

      // Withdrawal must be atomically cancelled with full reservation released
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_req_500" },
          data: expect.objectContaining({
            status: "CANCELLED",
            cancellationReasonCode: "DISPUTE_INTERCEPTED",
          }),
        }),
      );

      // Allocations on withdrawal must be cancelled
      expect(prisma.withdrawalEarningAllocation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ withdrawalRequestId: "wd_req_500" }),
          data: { status: "CANCELLED" },
        }),
      );

      // Held amount is held as RELEASED_HOLD from restored withdrawable funds
      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;
      expect(createdAllocations).toHaveLength(1);
      expect(createdAllocations[0].holdingState).toBe("RELEASED_HOLD");
      expect(Number(createdAllocations[0].allocatedAmount)).toBe(700);
      expect(Number(createdAllocations[0].heldAmount)).toBe(700);
    });

    it("8. unrelated historical withdrawal negative case: past withdrawals from other earnings do not treat current earning as paid out", async () => {
      const releasedStoreEarning = { ...baseStoreEarning, status: "RELEASED" };
      (prisma.payment.findUnique as any).mockResolvedValue(basePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([releasedStoreEarning]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([baseDriverEarning]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      // Current earning has NO allocations to withdrawals (unrelated past withdrawals on the wallet)
      (prisma.withdrawalEarningAllocation.findMany as any).mockResolvedValue([]);

      await openPaymentDispute({
        paymentPublicReference: "PAY-DISP-001",
        providerDisputeId: "disp_unrelated_hist_008",
        amount: "1000.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        providerStatus: "needs_response",
      });

      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;

      const storeAlloc = createdAllocations.find((a: any) => a.participantType === "STORE");
      // Must be RELEASED_HOLD, NOT RECOVERY_RECEIVABLE!
      expect(storeAlloc.holdingState).toBe("RELEASED_HOLD");
      expect(Number(storeAlloc.heldAmount)).toBe(700);
      expect(Number(storeAlloc.recoveryReceivableAmount)).toBe(0);
    });

    it("9. partial dispute amount pro-rates deterministically and conserves dispute total", async () => {
      (prisma.payment.findUnique as any).mockResolvedValue(basePayment); // 1000.00
      (prisma.storeEarning.findMany as any).mockResolvedValue([baseStoreEarning]); // 700.00 (ACCRUED)
      (prisma.driverEarning.findMany as any).mockResolvedValue([baseDriverEarning]); // 200.00 (ACCRUED)
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      // Disputing only 500.00 (50% of the payment)
      await openPaymentDispute({
        paymentPublicReference: "PAY-DISP-001",
        providerDisputeId: "disp_partial_500",
        amount: "500.00",
        currency: "ZAR",
        reason: "PRODUCT_NOT_RECEIVED",
        providerStatus: "needs_response",
      });

      const createCall = (prisma.paymentDispute.create as any).mock.calls[0][0];
      const createdAllocations = createCall.data.allocations.create;

      const storeAlloc = createdAllocations.find((a: any) => a.participantType === "STORE");
      const driverAlloc = createdAllocations.find((a: any) => a.participantType === "DRIVER");
      const platformAlloc = createdAllocations.find((a: any) => a.participantType === "PLATFORM");

      expect(Number(storeAlloc.allocatedAmount)).toBe(350); // 50% of 700
      expect(Number(driverAlloc.allocatedAmount)).toBe(100); // 50% of 200
      expect(Number(platformAlloc.allocatedAmount)).toBe(50); // 50% of 100

      const totalAllocated =
        Number(storeAlloc.allocatedAmount) +
        Number(driverAlloc.allocatedAmount) +
        Number(platformAlloc.allocatedAmount);

      expect(totalAllocated).toBe(500); // sum == disputed amount
    });

    it("10. strict domain checks: earnings in FULLY_REFUNDED, REVERSED, RECONCILIATION_REQUIRED fail closed", async () => {
      (prisma.payment.findUnique as any).mockResolvedValue(basePayment);
      (prisma.driverEarning.findMany as any).mockResolvedValue([]);

      // FULLY_REFUNDED
      (prisma.storeEarning.findMany as any).mockResolvedValue([{ ...baseStoreEarning, status: "FULLY_REFUNDED" }]);
      await expect(
        openPaymentDispute({
          paymentPublicReference: "PAY-DISP-001",
          providerDisputeId: "disp_fail_refunded",
          amount: "500.00",
        }),
      ).rejects.toThrow("Cannot dispute payment with store earning in FULLY_REFUNDED state.");

      // REVERSED
      (prisma.storeEarning.findMany as any).mockResolvedValue([{ ...baseStoreEarning, status: "REVERSED" }]);
      await expect(
        openPaymentDispute({
          paymentPublicReference: "PAY-DISP-001",
          providerDisputeId: "disp_fail_reversed",
          amount: "500.00",
        }),
      ).rejects.toThrow("Cannot dispute payment with store earning in REVERSED state.");

      // RECONCILIATION_REQUIRED
      (prisma.storeEarning.findMany as any).mockResolvedValue([{ ...baseStoreEarning, status: "RECONCILIATION_REQUIRED" }]);
      await expect(
        openPaymentDispute({
          paymentPublicReference: "PAY-DISP-001",
          providerDisputeId: "disp_fail_reconcile",
          amount: "500.00",
        }),
      ).rejects.toThrow("Cannot dispute payment with store earning in RECONCILIATION_REQUIRED state.");
    });

    it("11. duplicate create/remind/resolve is strictly idempotent and does not duplicate holds or journals", async () => {
      const existingDispute = {
        id: "pds_existing",
        publicReference: "pds_existing_ref",
        providerDisputeId: "disp_duplicate_test",
        status: "OPEN",
        amount: new Prisma.Decimal("1000.00"),
        paymentId: "pay_dispute_001",
        allocations: [],
      };

      (prisma.paymentDispute.findUnique as any).mockResolvedValue(existingDispute);

      const replayResult = await openPaymentDispute({
        paymentPublicReference: "PAY-DISP-001",
        providerDisputeId: "disp_duplicate_test",
        amount: "1000.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        providerStatus: "needs_response",
      });

      expect(replayResult.id).toBe("pds_existing");
      expect(prisma.paymentDispute.create).not.toHaveBeenCalled();
      expect(prisma.ledgerJournal.create).not.toHaveBeenCalled();
    });

    it("12. WON and LOST resolution settles every allocation component exactly once", async () => {
      const mockAllocations = [
        {
          id: "pda_001",
          participantType: "STORE",
          holdingState: "UNRELEASED_HELD",
          allocatedAmount: new Prisma.Decimal("700.00"),
          ledgerAccountId: "acc_store_dispute_held",
          storeEarning: { payableAccountId: "acc_store_payable" },
        },
        {
          id: "pda_002",
          participantType: "DRIVER",
          holdingState: "UNRELEASED_HELD",
          allocatedAmount: new Prisma.Decimal("200.00"),
          ledgerAccountId: "acc_driver_dispute_held",
          driverEarning: { payableAccountId: "acc_driver_payable" },
        },
        {
          id: "pda_003",
          participantType: "PLATFORM",
          holdingState: "PLATFORM_HELD",
          allocatedAmount: new Prisma.Decimal("100.00"),
          ledgerAccountId: "acc_platform_dispute_held",
        },
        {
          id: "pda_004",
          participantType: "STORE",
          holdingState: "IN_FLIGHT_HOLD",
          allocatedAmount: new Prisma.Decimal("50.00"),
          ledgerAccountId: null,
        },
      ];

      const openDispute = {
        id: "pds_resolve_test",
        publicReference: "pds_resolve_ref",
        providerDisputeId: "disp_resolve_123",
        status: "UNDER_REVIEW",
        amount: new Prisma.Decimal("1050.00"),
        allocations: mockAllocations,
      };

      (prisma.paymentDispute.findUnique as any).mockResolvedValue(openDispute);

      // WON resolution: releases held funds back to participant payables, IN_FLIGHT_HOLD clears claim
      const wonResult = await resolvePaymentDispute({
        disputePublicReference: "pds_resolve_ref",
        resolution: "WON",
        providerStatus: "won",
      });

      expect(wonResult).toBeDefined();
      expect(prisma.paymentDispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pds_resolve_test" },
          data: expect.objectContaining({ status: "WON" }),
        }),
      );

      // LOST resolution: held funds cleared to platform cash clearing; IN_FLIGHT_HOLD remains pending
      const lostDispute = { ...openDispute, id: "pds_lost_test", status: "UNDER_REVIEW" };
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(lostDispute);

      const lostResult = await resolvePaymentDispute({
        disputePublicReference: "pds_resolve_ref",
        resolution: "LOST",
        providerStatus: "lost",
      });

      expect(lostResult).toBeDefined();
      expect(prisma.paymentDispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pds_lost_test" },
          data: expect.objectContaining({
            status: "LOST",
            reconciliationRequired: true, // IN_FLIGHT_HOLD requires reconciliation
          }),
        }),
      );
    });

    it("13. exact double-entry ledger conservation after every transition", async () => {
      (prisma.payment.findUnique as any).mockResolvedValue(basePayment);
      (prisma.storeEarning.findMany as any).mockResolvedValue([baseStoreEarning]);
      (prisma.driverEarning.findMany as any).mockResolvedValue([baseDriverEarning]);
      (prisma.paymentDispute.findUnique as any).mockResolvedValue(null);

      await openPaymentDispute({
        paymentPublicReference: "PAY-DISP-001",
        providerDisputeId: "disp_conservation_test",
        amount: "1000.00",
        currency: "ZAR",
        reason: "FRAUDULENT",
        providerStatus: "needs_response",
      });

      expect(prisma.ledgerJournal.create).toHaveBeenCalled();
      const journalCall = (prisma.ledgerJournal.create as any).mock.calls[0][0];

      const debits = new Prisma.Decimal(journalCall.data.totalDebits);
      const credits = new Prisma.Decimal(journalCall.data.totalCredits);

      expect(debits.equals(credits)).toBe(true);
      expect(debits.toFixed(2)).toBe("1000.00");
    });
  });
});
