import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const mock = vi.hoisted(() => ({
  authorize: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mock.authorize }));
vi.mock("@/lib/rewards/customer-loyalty-leaderboard.service", () => ({
  listCustomerLoyaltyLeaderboard: mock.list,
}));
import { GET } from "@/app/api/admin/loyalty/leaderboard/route";

const request = (search = "") => new NextRequest("https://ktcouriers.test/api/admin/loyalty/leaderboard" + search);

describe("owner customer loyalty leaderboard access boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.authorize.mockResolvedValue({ user: { id: "admin-a", role: "SUPER_ADMIN" } });
    mock.list.mockResolvedValue({
      data: [{ rank: 1, customerUserId: "customer-a", availablePoints: "175" }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      scope: "ACTIVE_CUSTOMERS_WITH_LOYALTY_ACCOUNTS",
    });
  });

  it("checks customers.read before any database query", async () => {
    mock.authorize.mockResolvedValueOnce({ response: new Response("forbidden", { status: 403 }) });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.authorize).toHaveBeenCalledWith(PERMISSIONS.CUSTOMERS_READ, { request: expect.any(NextRequest) });
  });

  it("returns stable, paginated point totals with private cache protection", async () => {
    const response = await GET(request("?page=2&pageSize=30"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mock.list).toHaveBeenCalledWith({ page: 2, pageSize: 30 });
    expect(await response.json()).toMatchObject({
      data: [{ rank: 1, customerUserId: "customer-a" }],
    });
  });

  it("refuses malformed and unbounded pagination", async () => {
    for (const query of ["?page=0", "?page=-1", "?page=1e7", "?page=1001", "?pageSize=101", "?pageSize=Infinity", "?pageSize=0"]) {
      const response = await GET(request(query));
      expect(response.status).toBe(422);
    }
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("does not leak database failures to the admin browser", async () => {
    mock.list.mockRejectedValueOnce(new Error("sensitive customer email"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("sensitive customer email");
  });
});
