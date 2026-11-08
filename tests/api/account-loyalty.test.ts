import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findAccount: vi.fn(),
  loadPolicy: vi.fn(),
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mock.getCurrentUser }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { customerLoyaltyAccount: { findUnique: mock.findAccount } },
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

  it("shows only the authenticated customer's string-serialized points, no wallet redemption", async () => {
    mock.findAccount.mockResolvedValueOnce({
      availablePoints: 150n, debtPoints: 0n, lifetimeEarnedPoints: 220n,
      lifetimeReversedPoints: 70n,
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
      include: { movements: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 } },
    });
    expect(await response.json()).toMatchObject({
        availablePoints: "150", debtPoints: "0",
        lifetimeEarnedPoints: "220", lifetimeReversedPoints: "70",
        pointsPerRand: 1,
        conversion: { pointsRequired: 100, walletRand: "2.00", enabled: false },
        movements: [{ reference: "movement-1", changePoints: "50", availablePointsAfter: "150" }],
    });
  });

  it("returns a safe server error when ledger evidence cannot be read", async () => {
    mock.findAccount.mockRejectedValueOnce(new Error("Postgres temporarily offline"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("Postgres temporarily offline");
  });
});
