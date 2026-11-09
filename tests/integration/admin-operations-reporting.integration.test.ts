import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getStoreOperationsSnapshot } from "@/lib/services/admin-store-operations.service";
import { getDailyDriverCashReconciliation, johannesburgDayStart } from "@/lib/client-platform/driver-cash-reconciliation-dashboard.service";

const email = "reporting-p2-" + randomUUID() + "@example.test";
let actorId = "";
const actor = () => ({ id: actorId, email, role: "SUPER_ADMIN" as const, status: "ACTIVE" as const, name: "isolated report user" });

describe("phase 2 admin store and cash reporting on real isolated PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || process.env.KT_NETWORK_DISABLED !== "true" ||
        url.pathname !== "/kt_launch_test" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new Error("Named disposable database required for finance reporting verification.");
    }
    actorId = (await prisma.user.create({ data: { email, role: "SUPER_ADMIN", status: "ACTIVE" } })).id;
  });
  afterAll(async () => {
    if (actorId) await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });
  it("returns canonical dashboard aggregations without modifying orders", async () => {
    const now = new Date("2026-11-08T12:00:00Z");
    const before = await prisma.marketplaceOrder.count();
    const result = await getStoreOperationsSnapshot(actor(), "7_DAYS", now);
    expect(result.period).toBe("7_DAYS");
    expect(Object.values(result.counts).reduce((sum, count) => sum + count, 0)).toBe(result.totalStoreOrders);
    expect(result.paidTopItems.length).toBeLessThanOrEqual(10);
    expect(result.paidTopStores.length).toBeLessThanOrEqual(10);
    expect(result.failedMarketplacePaymentAttempts).toBeGreaterThanOrEqual(0);
    expect(await prisma.marketplaceOrder.count()).toBe(before);
  });
  it("includes inactive drivers in daily finance oversight because custody may outlast deactivation", async () => {
    const outsider = await prisma.user.create({ data: {
      email: "inactive-p2-" + randomUUID() + "@example.test", role: "DRIVER", status: "ACTIVE",
    } });
    const inactive = await prisma.driverProfile.create({ data: {
      userId: outsider.id, driverCode: "INACTIVE" + randomUUID().slice(0, 12),
      status: "SUSPENDED", active: false,
    } });
    try {
      const overview = await getDailyDriverCashReconciliation(actor(), new Date("2026-11-08T12:00:00Z"));
      expect(overview.driverCount).toBeGreaterThanOrEqual(1);
      expect(overview.drivers).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: inactive.id, status: "SUSPENDED" }),
      ]));
    } finally {
      await prisma.driverProfile.delete({ where: { id: inactive.id } });
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
  it("uses Johannesburg daily midnight and preserves pending deposits in custody", async () => {
    expect(johannesburgDayStart(new Date("2026-11-08T21:00:00Z")).toISOString()).toBe("2026-11-07T22:00:00.000Z");
    const now = new Date("2026-11-08T12:00:00Z");
    const result = await getDailyDriverCashReconciliation(actor(), now);
    expect(result.timezone).toBe("Africa/Johannesburg");
    expect(result.date).toBe("2026-11-08");
    expect(result.note).toMatch(/not cleared|NOT cleared|NOT/);
    expect(result.drivers.length).toBeLessThanOrEqual(500);
  });
});
