import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findAccount: vi.fn(),
  loadPolicy: vi.fn(),
  findConversionSetting: vi.fn(),
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mock.getCurrentUser }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    customerLoyaltyAccount: { findUnique: mock.findAccount },
    systemSetting: { findUnique: mock.findConversionSetting },
  },
}));
vi.mock("@/lib/rewards/customer-reward-configuration", () => ({
  loadCustomerRewardPolicy: mock.loadPolicy,
}));
import { GET } from "@/app/api/account/loyalty/route";

describe("account loyalty points read-only, authenticated and tenant-bound", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.getCurrentUser.mockResolvedValue({ id: "customer-a", role: "CUSTOMER", status: "ACTIVE" });
    mock.findAccount.mockResolvedValue(null);
    mock.loadPolicy.mockResolvedValue({ pointsPerZar: 1, conversionPoints: 100, conversionWalletZar: "2.00" });
    mock.findConversionSetting.mockResolvedValue({ type: "BOOLEAN", value: false });
  });

  it("blocks anonymous and noncustomer sessions before touching the database", async () => {
    mock.getCurrentUser.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(401);
    for (const actor of [
      { id: "admin-a", role: "ADMIN", status: "ACTIVE" },
      { id: "driver-a", role: "DRIVER", status: "ACTIVE" },
      { id: "customer-a", role: "CUSTOMER", status: "SUSPENDED" },
    ]) {
      mock.getCurrentUser.mockResolvedValueOnce(actor);
      expect((await GET()).status).toBe(403);
    }
    expect(mock.findAccount).not.toHaveBeenCalled();
  });

  it("shows only the authenticated customer's serialized points and redemption history", async () => {
    mock.findAccount.mockResolvedValueOnce({
      availablePoints: 150n, debtPoints: 0n, lifetimeEarnedPoints: 220n,
      lifetimeReversedPoints: 70n,
      redemptions: [{
        id: "redemption-1", operationId: "op-unique-01",
        pointsRedeemed: 100n, availablePointsAfter: 150n,
        walletCreditAmount: { toFixed: () => "2.00" }, createdAt: new Date("2026-11-08T04:05:00.000Z"),
      }],
      movements: [{
        id: "movement-1", deltaPoints: 50n, availablePointsAfter: 150n, debtPointsAfter: 0n,
        createdAt: new Date("2026-11-08T04:00:00.000Z"),
      }],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mock.findAccount).toHaveBeenCalledWith({
      where: { userId: "customer-a" },
      include: {
        movements: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 },
        redemptions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 },
      },
    });
    expect(await response.json()).toMatchObject({
        availablePoints: "150", debtPoints: "0",
        lifetimeEarnedPoints: "220", lifetimeReversedPoints: "70",
        pointsPerRand: 1,
        conversion: { pointsRequired: 100, walletRand: "2.00", enabled: false },
        redemptions: [{ reference: "redemption-1", pointsRedeemed: "100", walletCreditZar: "2.00" }],
        movements: [{ reference: "movement-1", changePoints: "50", availablePointsAfter: "150" }],
    });
  });

  it("reflects the admin's explicit conversion toggle without enabling it by default", async () => {
    mock.findConversionSetting.mockResolvedValueOnce({ type: "BOOLEAN", value: true });
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).conversion.enabled).toBe(true);
    expect(mock.findConversionSetting).toHaveBeenCalledWith({
      where: { key: "loyalty.conversion_enabled" },
      select: { type: true, value: true },
    });
  });

  it("returns a safe server error when ledger evidence cannot be read", async () => {
    mock.findAccount.mockRejectedValueOnce(new Error("Postgres temporarily offline"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("Postgres temporarily offline");
  });
});
