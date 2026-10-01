import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "@/types/domain";
const db = vi.hoisted(() => ({
  driverProfile: { findUnique: vi.fn() },
  systemSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  driverCashDeposit: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  cashOnDelivery: { findUnique: vi.fn() },
  cashOnDeliveryReconciliation: { findUnique: vi.fn() },
  adminActivityLog: { create: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));
const permissions = vi.hoisted(() => vi.fn());
const reconcile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: permissions }));
vi.mock("@/lib/services/cash-on-delivery.service", () => ({
  reconcileCashCollection: reconcile,
}));
import {
  BankInstructionsSchema,
  DepositReviewSchema,
  submitDriverDeposit,
  reviewDriverDeposit,
  saveBankInstructions,
} from "@/lib/client-platform/driver-cash.service";
const input = {
  orderId: "corder12345678901234567890",
  amount: "100.00",
  bankReference: "BANK-REAL-REF",
  operationId: "deposit-operation-123",
};
const bank = {
  bankName: "Bank test",
  accountName: "KT test",
  accountNumber: "123456789",
  branchCode: "123456",
  referenceHint: "Use delivery reference",
  expectedVersion: 1,
};
const actor = {
  id: "admin",
  role: "ADMIN",
  status: "ACTIVE",
} as AuthenticatedUser;
const deposit = {
  id: "deposit-1",
  ...input,
  amount: new Prisma.Decimal(input.amount),
  driverProfileId: "driver-1",
  status: "PENDING",
  reviewedByUserId: null,
};
const receipt = {
  cashOnDelivery: { orderId: input.orderId },
  collectorDriverId: "driver-1",
  receivedAmount: new Prisma.Decimal(100),
  evidenceReference: `BANK:${input.bankReference}`,
  reconciledByUserId: "admin",
};
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) =>
    fn(db),
  );
  db.driverProfile.findUnique.mockResolvedValue({
    id: "driver-1",
    status: "ACTIVE",
    user: { role: "DRIVER", status: "ACTIVE" },
  });
  db.systemSetting.findUnique.mockResolvedValue({ value: bank });
  db.cashOnDelivery.findUnique.mockResolvedValue({
    collectorDriverId: "driver-1",
    status: "COLLECTED",
    cashCollected: new Prisma.Decimal(100),
    cashReconciled: new Prisma.Decimal(0),
  });
  db.driverCashDeposit.create.mockResolvedValue({
    id: deposit.id,
    status: "PENDING",
  });
  permissions.mockResolvedValue(true);
  db.driverCashDeposit.update.mockImplementation(
    ({ data }: { data: object }) => ({ ...deposit, ...data }),
  );
  db.driverCashDeposit.updateMany.mockResolvedValue({ count: 1 });
});
describe("driver cash deposit verification", () => {
  it("creates evidence without moving the ledger or reducing custody", async () => {
    await submitDriverDeposit("driver-user", input);
    expect(
      db.driverCashDeposit.create.mock.calls[0][0].data.driverProfileId,
    ).toBe("driver-1");
    expect(reconcile).not.toHaveBeenCalled();
    expect(db.adminActivityLog.create.mock.calls[0][0].data.actorUserId).toBe(
      "driver-user",
    );
  });
  it("rejects another collector's cash", async () => {
    db.cashOnDelivery.findUnique.mockResolvedValue({
      collectorDriverId: "other",
      status: "COLLECTED",
    });
    await expect(
      submitDriverDeposit("driver-user", input),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.driverCashDeposit.create).not.toHaveBeenCalled();
  });
  it("rejects partial or excessive deposits", async () => {
    await expect(
      submitDriverDeposit("driver-user", { ...input, amount: "99.99" }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("blocks submission when actual bank instructions are missing", async () => {
    db.systemSetting.findUnique.mockResolvedValue(null);
    await expect(
      submitDriverDeposit("driver-user", input),
    ).rejects.toMatchObject({ code: "BANK_INSTRUCTIONS_MISSING" });
  });
  it("replays identical deposit submissions and rejects changed references", async () => {
    db.driverCashDeposit.findUnique.mockResolvedValue(deposit);
    await expect(
      submitDriverDeposit("driver-user", input),
    ).resolves.toMatchObject({ replayed: true });
    await expect(
      submitDriverDeposit("driver-user", {
        ...input,
        bankReference: "CHANGED-REF",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("requires active driver identity", async () => {
    db.driverProfile.findUnique.mockResolvedValue({
      id: "driver-1",
      status: "DISABLED",
      user: { role: "DRIVER", status: "ACTIVE" },
    });
    await expect(
      submitDriverDeposit("driver-user", input),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("requires actual bank receipt verification", () => {
    expect(
      DepositReviewSchema.safeParse({
        decision: "CONFIRM",
        note: "Bank receipt checked",
        bankReceiptVerified: false,
      }).success,
    ).toBe(false);
  });
  it("rejecting evidence does not reconcile money", async () => {
    db.driverCashDeposit.findUnique.mockResolvedValue(deposit);
    await expect(
      reviewDriverDeposit(actor, deposit.id, {
        decision: "REJECT",
        note: "Reference not received",
        bankReceiptVerified: false,
      }),
    ).resolves.toMatchObject({ status: "REJECTED" });
    expect(reconcile).not.toHaveBeenCalled();
  });
  it("recovers after reconciliation committed but response was lost", async () => {
    db.driverCashDeposit.findUnique.mockResolvedValue({
      ...deposit,
      status: "PROCESSING",
      reviewedByUserId: actor.id,
    });
    db.cashOnDeliveryReconciliation.findUnique.mockResolvedValue(receipt);
    await expect(
      reviewDriverDeposit(actor, deposit.id, {
        decision: "CONFIRM",
        note: "Bank receipt checked",
        bankReceiptVerified: true,
      }),
    ).resolves.toMatchObject({ status: "CONFIRMED" });
    expect(reconcile).not.toHaveBeenCalled();
  });
  it("calls the canonical ledger once and verifies the posted receipt", async () => {
    db.driverCashDeposit.findUnique.mockResolvedValue(deposit);
    db.cashOnDeliveryReconciliation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(receipt);
    await reviewDriverDeposit(actor, deposit.id, {
      decision: "CONFIRM",
      note: "Bank receipt checked",
      bankReceiptVerified: true,
    });
    expect(reconcile).toHaveBeenCalledWith({
      orderId: input.orderId,
      actorUserId: "admin",
      receivedAmount: "100.00",
      operationId: `cash-deposit:${deposit.id}`,
      evidenceReference: `BANK:${input.bankReference}`,
    });
  });
  it("does not confirm a mismatched reconciliation receipt", async () => {
    db.driverCashDeposit.findUnique.mockResolvedValue({
      ...deposit,
      status: "PROCESSING",
      reviewedByUserId: actor.id,
    });
    db.cashOnDeliveryReconciliation.findUnique.mockResolvedValue({
      ...receipt,
      receivedAmount: new Prisma.Decimal(99),
    });
    await expect(
      reviewDriverDeposit(actor, deposit.id, {
        decision: "CONFIRM",
        note: "Bank receipt checked",
        bankReceiptVerified: true,
      }),
    ).rejects.toMatchObject({ code: "DEPOSIT_RECEIPT_CONFLICT" });
    expect(db.driverCashDeposit.updateMany).not.toHaveBeenCalled();
  });
  it("denies unauthorized reviewers before reading deposits", async () => {
    permissions.mockResolvedValue(false);
    await expect(
      reviewDriverDeposit(actor, deposit.id, {
        decision: "CONFIRM",
        note: "Bank receipt checked",
        bankReceiptVerified: true,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.driverCashDeposit.findUnique).not.toHaveBeenCalled();
  });
  it("protects bank configuration against stale edits", async () => {
    await expect(
      saveBankInstructions(actor, { ...bank, expectedVersion: 0 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.systemSetting.upsert).not.toHaveBeenCalled();
  });
  it("rejects bank account text that is not a number", () => {
    expect(
      BankInstructionsSchema.safeParse({
        ...bank,
        accountNumber: "not-an-account",
      }).success,
    ).toBe(false);
  });
});
