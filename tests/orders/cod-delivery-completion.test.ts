import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  cashOnDelivery: { findUnique: vi.fn() },
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
};
beforeEach(() => {
  vi.resetAllMocks();
  db.$queryRaw.mockResolvedValue([{ id: "cod" }]);
  db.cashOnDelivery.findUnique.mockResolvedValue(complete);
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
