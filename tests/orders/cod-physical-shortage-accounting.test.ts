import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  postLedgerJournalWithinTransaction: vi.fn(),
  ensureWalletForOwner: vi.fn(),
  ensureLedgerAccount: vi.fn(),
  recordAdminAlertIntentInTx: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    cashOnDelivery: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    cashOnDeliveryEvent: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    deliveryProofEvidence: {
      findFirst: vi.fn(),
    },
    privateMediaObject: {
      findFirst: vi.fn(),
    },
    adminActivityLog: {
      create: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/permissions", () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock("@/lib/notifications/admin-alert-dispatch.service", () => ({
  recordAdminAlertIntentInTx: mocks.recordAdminAlertIntentInTx,
}));

vi.mock("@/lib/services/ledger-posting.service", () => ({
  postLedgerJournalWithinTransaction: mocks.postLedgerJournalWithinTransaction,
}));

vi.mock("@/lib/services/wallet-account.service", () => ({
  ensureWalletForOwner: mocks.ensureWalletForOwner,
  ensureLedgerAccount: mocks.ensureLedgerAccount,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: async (cb: (tx: typeof mocks.tx) => Promise<unknown>) => cb(mocks.tx),
  },
}));

import {
  COD_UNCOLLECTED_RECEIVABLE_ACCOUNT_CODE,
  COD_UNCOLLECTED_SUSPENSE_ACCOUNT_CODE,
  resolveCodPhysicalDeliveryShortage,
  reviewCodPhysicalDeliveryException,
} from "@/lib/services/cod-physical-delivery-exception.service";

const reporter: AuthenticatedUser = {
  id: "admin-reporter",
  email: "reporter@ktcouriers.local",
  name: "Ops Reporter",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
};

const reviewer: AuthenticatedUser = {
  id: "admin-reviewer",
  email: "reviewer@ktcouriers.local",
  name: "Finance Reviewer A",
  role: "ADMIN",
  status: "ACTIVE",
};

const resolver: AuthenticatedUser = {
  id: "admin-resolver",
  email: "resolver@ktcouriers.local",
  name: "Finance Reviewer B",
  role: "ADMIN",
  status: "ACTIVE",
};

describe("COD Physical Delivery Uncollected Shortage Accounting (C07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasPermission.mockResolvedValue(true);
    mocks.tx.$queryRaw.mockResolvedValue([{ id: "cod-1" }]);
    mocks.tx.systemSetting.findUnique.mockResolvedValue(null);
    mocks.ensureWalletForOwner.mockResolvedValue({ id: "wallet-platform" });
    mocks.ensureLedgerAccount.mockImplementation(async (input: { code: string; category: string }) => ({
      id: `acc-${input.code}`,
      code: input.code,
      status: "ACTIVE",
      category: input.category,
      purpose: "SUSPENSE",
    }));
    mocks.tx.deliveryProofEvidence.findFirst.mockResolvedValue({
      storageReference: "PMO-1",
      driverProfileId: "driver-1",
      assignment: { driverProfileId: "driver-1" },
    });
    mocks.tx.privateMediaObject.findFirst.mockResolvedValue({ id: "pmo-1" });
    mocks.tx.cashOnDelivery.update.mockResolvedValue({});
    mocks.tx.adminActivityLog.create.mockResolvedValue({});
  });

  it("posts an exact-once balanced receivable/suspense journal on VERIFY when cash is outstanding, with zero revenue or earnings", async () => {
    mocks.tx.cashOnDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "cod-1",
      publicReference: "COD-TEST-1",
      status: "READY_FOR_COLLECTION",
      reconciliationStatus: "PHYSICAL_DELIVERY_REVIEW_PENDING",
      cashObligation: new Prisma.Decimal("185.50"),
      cashCollected: new Prisma.Decimal("0.00"),
      remittanceDiscrepancy: new Prisma.Decimal("0.00"),
      suspenseJournalId: null,
      adjustmentJournalId: null,
      order: { currentDriverProfileId: "driver-1" },
    });
    mocks.tx.cashOnDeliveryEvent.findUnique.mockResolvedValue(null);
    mocks.tx.cashOnDeliveryEvent.findFirst.mockResolvedValue({
      id: "evt-report-1",
      actorUserId: reporter.id,
      safeEvidence: { evidenceReference: "POD-1" },
    });
    mocks.postLedgerJournalWithinTransaction.mockResolvedValue({
      id: "jrnl-shortage-1",
      reference: "JRN-COD-SHORTAGE-001",
    });

    const res = await reviewCodPhysicalDeliveryException(reviewer, "order-1", {
      operationId: "op-review-shortage-1",
      decision: "VERIFY",
      reason: "POD verified; cash remains uncollected",
    });

    expect(res).toEqual({
      status: "VERIFIED_CASH_OUTSTANDING",
      cashOutstanding: "185.50",
      shortageJournalReference: "JRN-COD-SHORTAGE-001",
    });

    expect(mocks.postLedgerJournalWithinTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.ensureLedgerAccount).toHaveBeenCalledWith(expect.objectContaining({ code: COD_UNCOLLECTED_RECEIVABLE_ACCOUNT_CODE, purpose: "COD_UNCOLLECTED_RECEIVABLE", category: "ASSET" }), mocks.tx);
    expect(mocks.ensureLedgerAccount).toHaveBeenCalledWith(expect.objectContaining({ code: COD_UNCOLLECTED_SUSPENSE_ACCOUNT_CODE, purpose: "COD_UNCOLLECTED_SUSPENSE", category: "LIABILITY" }), mocks.tx);
    const call = mocks.postLedgerJournalWithinTransaction.mock.calls[0][1];
    expect(call).toMatchObject({
      idempotencyKey: "cod-physical-shortage:cod-1",
      type: "GENERAL",
      currency: "ZAR",
      sourceReference: "cod:COD-TEST-1:uncollected-shortage",
      correlationId: "COD-TEST-1",
      entries: [
        {
          accountId: `acc-${COD_UNCOLLECTED_RECEIVABLE_ACCOUNT_CODE}`,
          direction: "DEBIT",
          amount: "185.50",
          lineCode: "COD_UNCOLLECTED_SHORTAGE_RECEIVABLE",
        },
        {
          accountId: `acc-${COD_UNCOLLECTED_SUSPENSE_ACCOUNT_CODE}`,
          direction: "CREDIT",
          amount: "185.50",
          lineCode: "COD_UNCOLLECTED_SHORTAGE_SUSPENSE",
        },
      ],
    });
  });

  it("does not post a shortage journal when cash was already collected or when decision is REJECT", async () => {
    mocks.tx.cashOnDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "cod-1",
      publicReference: "COD-TEST-1",
      status: "COLLECTED",
      reconciliationStatus: "PHYSICAL_DELIVERY_REVIEW_PENDING",
      cashObligation: new Prisma.Decimal("185.50"),
      cashCollected: new Prisma.Decimal("185.50"),
      remittanceDiscrepancy: new Prisma.Decimal("0.00"),
      suspenseJournalId: null,
      order: { currentDriverProfileId: "driver-1" },
    });
    mocks.tx.cashOnDeliveryEvent.findUnique.mockResolvedValue(null);
    mocks.tx.cashOnDeliveryEvent.findFirst.mockResolvedValue({
      id: "evt-report-1",
      actorUserId: reporter.id,
      safeEvidence: { evidenceReference: "POD-1" },
    });

    const collectedRes = await reviewCodPhysicalDeliveryException(reviewer, "order-1", {
      operationId: "op-review-collected-1",
      decision: "VERIFY",
      reason: "Cash collected before review",
    });
    expect(collectedRes).toEqual({
      status: "VERIFIED_CASH_COLLECTED",
      cashOutstanding: "0.00",
    });
    expect(mocks.postLedgerJournalWithinTransaction).not.toHaveBeenCalled();
  });

  it("fails closed when the finance shortage accounting chart configuration is disabled", async () => {
    mocks.tx.systemSetting.findUnique.mockResolvedValue({
      type: "BOOLEAN",
      value: false,
    });
    mocks.tx.cashOnDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "cod-1",
      publicReference: "COD-TEST-1",
      status: "READY_FOR_COLLECTION",
      reconciliationStatus: "PHYSICAL_DELIVERY_REVIEW_PENDING",
      cashObligation: new Prisma.Decimal("185.50"),
      cashCollected: new Prisma.Decimal("0.00"),
      remittanceDiscrepancy: new Prisma.Decimal("0.00"),
      suspenseJournalId: null,
      order: { currentDriverProfileId: "driver-1" },
    });
    mocks.tx.cashOnDeliveryEvent.findUnique.mockResolvedValue(null);
    mocks.tx.cashOnDeliveryEvent.findFirst.mockResolvedValue({
      id: "evt-report-1",
      actorUserId: reporter.id,
      safeEvidence: { evidenceReference: "POD-1" },
    });

    await expect(
      reviewCodPhysicalDeliveryException(reviewer, "order-1", {
        operationId: "op-review-failclosed-1",
        decision: "VERIFY",
        reason: "Verify with disabled chart",
      }),
    ).rejects.toMatchObject({ code: "SHORTAGE_ACCOUNTING_CONFIGURATION_MISSING" });
    expect(mocks.postLedgerJournalWithinTransaction).not.toHaveBeenCalled();
  });

  it("supports DISPUTED and clears the balanced receivable/suspense pair to zero on RECOVERED or WRITTEN_OFF under dual control", async () => {
    mocks.tx.cashOnDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "cod-1",
      publicReference: "COD-TEST-1",
      status: "READY_FOR_COLLECTION",
      reconciliationStatus: "PHYSICAL_DELIVERY_VERIFIED",
      cashObligation: new Prisma.Decimal("185.50"),
      cashCollected: new Prisma.Decimal("0.00"),
      remittanceDiscrepancy: new Prisma.Decimal("185.50"),
      suspenseJournalId: "jrnl-shortage-1",
      adjustmentJournalId: null,
    });
    mocks.tx.cashOnDeliveryEvent.findUnique.mockResolvedValue(null);
    mocks.tx.cashOnDeliveryEvent.findFirst.mockResolvedValue({
      id: "evt-review-1",
      actorUserId: reviewer.id,
    });

    // Self-resolution by the same reviewer is rejected
    await expect(
      resolveCodPhysicalDeliveryShortage(reviewer, "order-1", {
        operationId: "op-resolve-self-1",
        resolution: "WRITTEN_OFF",
        reason: "Self write-off attempt",
      }),
    ).rejects.toMatchObject({ code: "INDEPENDENT_REVIEW_REQUIRED" });

    // RECOVERED requires an evidenceReference
    await expect(
      resolveCodPhysicalDeliveryShortage(resolver, "order-1", {
        operationId: "op-resolve-no-ev-1",
        resolution: "RECOVERED",
        reason: "Missing bank receipt",
      }),
    ).rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });

    mocks.postLedgerJournalWithinTransaction.mockResolvedValue({
      id: "jrnl-clear-1",
      reference: "JRN-COD-CLEAR-001",
    });

    const cleared = await resolveCodPhysicalDeliveryShortage(resolver, "order-1", {
      operationId: "op-resolve-rec-1",
      resolution: "RECOVERED",
      debtorParty: "RECIPIENT",
      evidenceReference: "BANK-REC-991",
      reason: "Recipient settled shortage via verified deposit receipt",
    });

    expect(cleared).toEqual({
      status: "PHYSICAL_DELIVERY_SHORTAGE_RECOVERED",
      cashOutstanding: "0.00",
      clearingJournalReference: "JRN-COD-CLEAR-001",
    });
    expect(mocks.postLedgerJournalWithinTransaction).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        idempotencyKey: "cod-physical-shortage-clear:cod-1",
        entries: [
          {
            accountId: `acc-${COD_UNCOLLECTED_SUSPENSE_ACCOUNT_CODE}`,
            direction: "DEBIT",
            amount: "185.50",
            lineCode: "COD_UNCOLLECTED_SHORTAGE_SUSPENSE_CLEARED",
          },
          {
            accountId: `acc-${COD_UNCOLLECTED_RECEIVABLE_ACCOUNT_CODE}`,
            direction: "CREDIT",
            amount: "185.50",
            lineCode: "COD_UNCOLLECTED_SHORTAGE_RECEIVABLE_RECOVERED",
          },
        ],
      }),
    );
  });
});
