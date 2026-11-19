import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  cashOnDelivery: { findUnique: vi.fn() },
  ledgerJournal: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { assertCashReadyForDeliveryWithinTransaction } from "@/lib/services/cash-on-delivery.service";
const complete = {
  digitalPaid: new Prisma.Decimal(50),
  digitalRequired: new Prisma.Decimal(50),
  cashCollected: new Prisma.Decimal(50),
  cashObligation: new Prisma.Decimal(50),
  collectorDriverId: "driver",
  status: "COLLECTED",
  publicReference: "COD-1", collectionJournalId: "journal", collectedAt: new Date(), collectionOperationId: "operation",
};
beforeEach(() => {
  vi.resetAllMocks();
  db.$queryRaw.mockResolvedValue([{ id: "cod" }]);
  db.cashOnDelivery.findUnique.mockResolvedValue(complete);
  db.ledgerJournal.findUnique.mockResolvedValue({ type: "GENERAL", currency: "ZAR", idempotencyKey: "cod-collect:operation", sourceReference: "COD:COD-1:COLLECTION", correlationId: "COD-1", totalDebits: new Prisma.Decimal(50), totalCredits: new Prisma.Decimal(50), reversalJournal: null, entries: [{ direction: "DEBIT", lineCode: "DRIVER_CASH_CUSTODY", amount: new Prisma.Decimal(50), account: { code: "DRIVER-COD-CASH-DRIVER" } }, { direction: "CREDIT", lineCode: "CUSTOMER_FUNDS_HELD", amount: new Prisma.Decimal(50), account: { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR" } }] });
});
const tx = db as unknown as Prisma.TransactionClient;
describe("COD completion money checks", () => {
  it("allows ordinary digital deliveries without COD", async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(
      assertCashReadyForDeliveryWithinTransaction(tx, "order", "driver"),
    ).resolves.toBeUndefined();
    expect(db.cashOnDelivery.findUnique).not.toHaveBeenCalled();
  });
  it("allows collected cash after the verified digital deposit", async () => {
    await expect(
      assertCashReadyForDeliveryWithinTransaction(tx, "order", "driver"),
    ).resolves.toBeUndefined();
  });
  it("rejects a missing or reversed collection journal", async () => {
    db.ledgerJournal.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ reversalJournal: { id: "reversal" } });
    await expect(assertCashReadyForDeliveryWithinTransaction(tx, "order", "driver")).rejects.toMatchObject({ code: "COD_COLLECTION_REQUIRED" });
    await expect(assertCashReadyForDeliveryWithinTransaction(tx, "order", "driver")).rejects.toMatchObject({ code: "COD_COLLECTION_REQUIRED" });
  });
  it.each([
    { cashCollected: new Prisma.Decimal(0) },
    { digitalPaid: new Prisma.Decimal(0) },
    { collectorDriverId: "other" },
    { status: "READY_FOR_COLLECTION" },
  ])("rejects incomplete or foreign cash evidence %j", async (change) => {
    db.cashOnDelivery.findUnique.mockResolvedValue({ ...complete, ...change });
    await expect(
      assertCashReadyForDeliveryWithinTransaction(tx, "order", "driver"),
    ).rejects.toMatchObject({ code: "COD_COLLECTION_REQUIRED" });
  });
});
