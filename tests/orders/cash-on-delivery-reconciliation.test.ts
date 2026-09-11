/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  createCashOnDeliveryObligation,
  recordCashCollection,
  reconcileCashCollection,
  adjustCashOnDelivery,
} from "@/lib/services/cash-on-delivery.service";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(async (query: any) => {
      const q = typeof query === "string" ? query : (query?.strings?.join(" ") ?? "");
      if (q.includes("LedgerAccount")) {
        const ids = Array.isArray(query?.values) && query.values.length > 0 ? query.values : ["acc_driver", "acc_held", "acc_cash", "acc_suspense", "acc_adj"];
        return ids.map((id: string) => ({ id }));
      }
      return [{ id: "cod_001" }];
    }),
    user: {
      findUnique: vi.fn(async () => ({ id: "usr_admin", status: "ACTIVE" })),
    },
    driverProfile: {
      findUnique: vi.fn(async () => ({ id: "drv_001", status: "ACTIVE" })),
    },
    cashOnDelivery: {
      findUnique: vi.fn(),
      create: vi.fn(async (args: any) => ({
        id: "cod_001",
        publicReference: "COD-001",
        ...args?.data,
      })),
      update: vi.fn(async (args: any) => ({
        id: args?.where?.id ?? "cod_001",
        ...args?.data,
      })),
    },
    wallet: {
      findUnique: vi.fn(async (args: any) => ({
        id: `wallet_${args?.where?.ownerType_ownerId_currency?.ownerType ?? "owner"}`,
        ownerType: args?.where?.ownerType_ownerId_currency?.ownerType ?? "PLATFORM",
        ownerId: args?.where?.ownerType_ownerId_currency?.ownerId ?? "platform",
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
          category: "ASSET",
          currency: "ZAR",
          status: "ACTIVE",
          allowNegative: true,
          currentBalance: new Prisma.Decimal("10000.00"),
          debitTotal: new Prisma.Decimal("0.00"),
          creditTotal: new Prisma.Decimal("10000.00"),
          version: 1,
          wallet: { id: "wallet_platform", ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" },
        };
      }),
      findMany: vi.fn(async (args: any) => {
        const ids = args?.where?.id?.in ?? ["acc_1", "acc_2", "acc_3"];
        return ids.map((id: string) => ({
          id,
          category: "ASSET",
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
      create: vi.fn(async (args: any) => ({
        id: `acc_${args?.data?.code}`,
        category: args?.data?.category,
        currency: "ZAR",
        status: "ACTIVE",
        allowNegative: true,
        currentBalance: new Prisma.Decimal("10000.00"),
        debitTotal: new Prisma.Decimal("0.00"),
        creditTotal: new Prisma.Decimal("10000.00"),
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
          id: args?.where?.id ?? "jnl_cod_001",
          reference: "JNL-COD-001",
          journalType: { code: "GENERAL" },
          currency: "ZAR",
          actorUserId: "usr_admin",
          actorType: "FINANCE_ADMIN",
          idempotencyKey: "idem_key",
          sourceReference: "src_ref",
          correlationId: "corr_id",
          memo: "memo",
          metadata: {},
          policyVersion: 1,
          totalDebits: new Prisma.Decimal("700.00"),
          totalCredits: new Prisma.Decimal("700.00"),
          originalJournal: null,
          reversalJournal: null,
          postedAt: new Date(),
          createdAt: new Date(),
          entries: [],
        };
      }),
      create: vi.fn(async (args: any) => ({
        id: "jnl_cod_001",
        reference: "JNL-COD-001",
        ...args?.data,
      })),
    },
    ledgerEntry: {
      createMany: vi.fn(async () => ({ count: 3 })),
    },
  };
  return { prisma: mockPrisma };
});

describe("Phase 1: Cash On Delivery Reconciliation & Suspense Accounting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCashOnDeliveryObligation Boundary", () => {
    it("correctly computes cash obligation for split deposit orders", async () => {
      const result = await createCashOnDeliveryObligation({
        orderId: "ord_split_001",
        policyMode: "DEPOSIT_PLUS_COD",
        authoritativePayable: "1200.00",
        digitalRequired: "400.00",
        digitalPaid: "400.00",
      });

      expect(prisma.cashOnDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: "ord_split_001",
            policyMode: "DEPOSIT_PLUS_COD",
            authoritativePayable: new Prisma.Decimal("1200.00"),
            digitalRequired: new Prisma.Decimal("400.00"),
            digitalPaid: new Prisma.Decimal("400.00"),
            cashObligation: new Prisma.Decimal("800.00"),
            status: "PENDING",
          }),
        }),
      );
      expect(result.id).toBe("cod_001");
    });

    it("rejects overpaid digital requirement or negative cash obligation", async () => {
      await expect(
        createCashOnDeliveryObligation({
          orderId: "ord_invalid",
          policyMode: "DEPOSIT_PLUS_COD",
          authoritativePayable: "500.00",
          digitalRequired: "600.00", // Required exceeds payable!
        }),
      ).rejects.toThrow("COD payment split is invalid.");
    });
  });

  describe("recordCashCollection Boundary", () => {
    it("debits driver custody and credits customer funds held on collection", async () => {
      const mockCod = {
        id: "cod_collect",
        publicReference: "COD-COLL-001",
        orderId: "ord_001",
        status: "READY_FOR_COLLECTION",
        policyMode: "FULL_COD",
        cashObligation: new Prisma.Decimal("500.00"),
        cashCollected: new Prisma.Decimal("0.00"),
        order: { currentDriverProfileId: "drv_001" },
      };

      (prisma.cashOnDelivery.findUnique as any).mockResolvedValue(mockCod);

      await recordCashCollection({
        orderId: "ord_001",
        collectorDriverId: "drv_001",
        actorUserId: "usr_admin",
        amount: "500.00",
        operationId: "op-collect-001",
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
              lineCode: "DRIVER_CASH_CUSTODY",
            }),
            expect.objectContaining({
              direction: "CREDIT",
              lineCode: "CUSTOMER_FUNDS_HELD",
            }),
          ]),
        }),
      );

      expect(prisma.cashOnDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cod_collect" },
          data: expect.objectContaining({
            status: "COLLECTED",
            collectorDriverId: "drv_001",
          }),
        }),
      );
    });
  });

  describe("reconcileCashCollection Boundary with Shortage Suspense", () => {
    it("posts 3-way split suspense journal on shortage and transitions to UNDER_RECONCILIATION", async () => {
      const mockCod = {
        id: "cod_short",
        publicReference: "COD-SHORT-001",
        orderId: "ord_short",
        status: "COLLECTED",
        collectorDriverId: "drv_001",
        cashCollected: new Prisma.Decimal("700.00"),
        reconciliationJournalId: null,
        suspenseJournalId: null,
      };

      (prisma.cashOnDelivery.findUnique as any).mockResolvedValue(mockCod);

      await reconcileCashCollection({
        orderId: "ord_short",
        actorUserId: "usr_admin",
        receivedAmount: "600.00", // 100 shortage!
        operationId: "op-recon-short-001",
        evidenceReference: "DEP-SLIP-777",
      });

      // 3-way balanced journal:
      // DEBIT platform cash: 600
      // DEBIT suspense: 100
      // CREDIT driver custody: 700
      expect(prisma.ledgerEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              direction: "DEBIT",
              lineCode: "PLATFORM_CASH_RECEIVED",
            }),
            expect.objectContaining({
              direction: "DEBIT",
              lineCode: "COD_SHORTAGE_SUSPENSE",
            }),
            expect.objectContaining({
              direction: "CREDIT",
              lineCode: "DRIVER_CUSTODY_RELEASED",
            }),
          ]),
        }),
      );

      expect(prisma.cashOnDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cod_short" },
          data: expect.objectContaining({
            cashReconciled: new Prisma.Decimal("600.00"),
            remittanceDiscrepancy: new Prisma.Decimal("100.00"),
            status: "UNDER_RECONCILIATION",
            reconciliationStatus: "UNDER_RECONCILIATION",
            suspenseJournalId: "jnl_cod_001",
          }),
        }),
      );
    });
  });

  describe("adjustCashOnDelivery Boundary", () => {
    it("clears suspense to platform adjustment on FORGIVE_SHORTAGE and transitions to RECONCILED", async () => {
      const mockCod = {
        id: "cod_adj",
        publicReference: "COD-ADJ-001",
        orderId: "ord_adj",
        status: "UNDER_RECONCILIATION",
        collectorDriverId: "drv_001",
        remittanceDiscrepancy: new Prisma.Decimal("100.00"),
        adjustmentJournalId: null,
      };

      (prisma.cashOnDelivery.findUnique as any).mockResolvedValue(mockCod);

      await adjustCashOnDelivery({
        orderId: "ord_adj",
        actorUserId: "usr_admin",
        adjustmentType: "FORGIVE_SHORTAGE",
        adjustmentReason: "Approved by finance manager for route cash drawer round-off",
        operationId: "op-adj-001",
      });

      // Adjustment clears suspense:
      // DEBIT platform adjustment: 100
      // CREDIT shortage suspense: 100
      expect(prisma.ledgerEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              direction: "DEBIT",
              lineCode: "PLATFORM_SHORTAGE_WRITEOFF",
            }),
            expect.objectContaining({
              direction: "CREDIT",
              lineCode: "COD_SHORTAGE_SUSPENSE_CLEARED",
            }),
          ]),
        }),
      );

      expect(prisma.cashOnDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cod_adj" },
          data: expect.objectContaining({
            status: "RECONCILED",
            reconciliationStatus: "RECONCILED",
            adjustmentJournalId: "jnl_cod_001",
          }),
        }),
      );
    });

    it("clears suspense to platform cash on RECOVER_FROM_DRIVER", async () => {
      const mockCod = {
        id: "cod_recover",
        publicReference: "COD-REC-001",
        orderId: "ord_recover",
        status: "UNDER_RECONCILIATION",
        collectorDriverId: "drv_001",
        remittanceDiscrepancy: new Prisma.Decimal("50.00"),
        adjustmentJournalId: null,
      };

      (prisma.cashOnDelivery.findUnique as any).mockResolvedValue(mockCod);

      await adjustCashOnDelivery({
        orderId: "ord_recover",
        actorUserId: "usr_admin",
        adjustmentType: "RECOVER_FROM_DRIVER",
        adjustmentReason: "Driver handed over missing R50 cash next morning",
        operationId: "op-rec-001",
      });

      expect(prisma.ledgerEntry.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              direction: "DEBIT",
              lineCode: "RECOVERED_CASH_RECEIVED",
            }),
            expect.objectContaining({
              direction: "CREDIT",
              lineCode: "COD_SHORTAGE_SUSPENSE_CLEARED",
            }),
          ]),
        }),
      );

      expect(prisma.cashOnDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cod_recover" },
          data: expect.objectContaining({
            status: "RECONCILED",
            reconciliationStatus: "RECONCILED",
          }),
        }),
      );
    });
  });
});
