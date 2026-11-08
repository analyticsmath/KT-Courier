import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { assertDriverCashCapacityForAssignment, assertDriverCashCapacityForCollection, DriverCashLimitError } from "@/lib/services/driver-cash-capacity.service";

function fixture(options: { held?: string; amount?: string; prior?: string; limit?: string; hasCod?: boolean } = {}) {
  const cod = options.hasCod === false ? null : { cashObligation: new Prisma.Decimal(options.amount ?? "125.00"), cashCollected: new Prisma.Decimal(0), status: "READY_FOR_COLLECTION" };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "driver" }]),
    cashOnDelivery: { findUnique: vi.fn().mockResolvedValue(cod) },
    driverProfile: { findUnique: vi.fn().mockResolvedValue({ cashLimitAmount: new Prisma.Decimal(options.limit ?? "1000.00") }) },
    ledgerAccount: { aggregate: vi.fn().mockResolvedValue({ _sum: { currentBalance: new Prisma.Decimal(options.held ?? "0") } }) },
    orderAssignment: { findMany: vi.fn().mockResolvedValue(options.prior ? [{ order: { cashOnDelivery: { cashObligation: new Prisma.Decimal(options.prior), cashCollected: new Prisma.Decimal(0), status: "READY_FOR_COLLECTION" } } }] : []) },
  };
  return tx;
}
describe("strict cash-in-hand driver limits", () => {
  it("does not need cash capacity to assign an online-only order", async () => {
    const tx = fixture({ hasCod: false });
    await expect(assertDriverCashCapacityForAssignment(tx as never, "driver", "order")).resolves.toBeUndefined();
    expect(tx.driverProfile.findUnique).not.toHaveBeenCalled();
  });
  it("refuses the next COD offer when unsettled held cash + reserved + new cash exceeds the cap", async () => {
    const tx = fixture({ held: "700.00", prior: "200.00", amount: "150.01" });
    await expect(assertDriverCashCapacityForAssignment(tx as never, "driver", "order")).rejects.toMatchObject({
      code: "DRIVER_CASH_LIMIT_EXCEEDED", held: "700.00", reserved: "200.00", requested: "150.01", limit: "1000.00",
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
  it("allows an offer exactly at the limit, using decimal arithmetic", async () => {
    const tx = fixture({ held: "700.00", prior: "200.00", amount: "100.00" });
    await expect(assertDriverCashCapacityForAssignment(tx as never, "driver", "order")).resolves.toBeUndefined();
  });
  it("rejects collection beyond the cap even when a legacy assignment bypassed normal offers", async () => {
    const tx = fixture({ held: "999.99" });
    await expect(assertDriverCashCapacityForCollection(tx as never, "driver", "current-order", new Prisma.Decimal("0.02"))).rejects.toBeInstanceOf(DriverCashLimitError);
  });
  it("rejects collection when held cash plus other active cash assignments would exceed the limit", async () => {
    const tx = fixture({ held: "900.00", prior: "100.00", limit: "1000.00" });
    await expect(assertDriverCashCapacityForCollection(tx as never, "driver", "current-order", new Prisma.Decimal("25.00")))
      .rejects.toMatchObject({
        code: "DRIVER_CASH_LIMIT_EXCEEDED", held: "900.00", reserved: "100.00",
        requested: "25.00", limit: "1000.00",
      });
    expect(tx.orderAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orderId: { not: "current-order" } }),
    }));
  });
  it("allows collecting an assigned order exactly at the remaining driver cash limit", async () => {
    const tx = fixture({ held: "700.00", prior: "200.00", limit: "1000.00" });
    await expect(assertDriverCashCapacityForCollection(tx as never, "driver", "current-order", new Prisma.Decimal("100.00")))
      .resolves.toBeUndefined();
  });
  it("a zero limit disables cash handling, not online delivery", async () => {
    const tx = fixture({ amount: "1.00", limit: "0.00" });
    await expect(assertDriverCashCapacityForAssignment(tx as never, "driver", "order")).rejects.toMatchObject({ code: "DRIVER_CASH_LIMIT_EXCEEDED" });
  });
});
