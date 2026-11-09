import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ currentUser: vi.fn() }));

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: mocks.currentUser,
}));

import { GET } from "@/app/api/public/account-navigation/route";

describe("public same-session account navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serves an anonymous browsing session without generating 401 console errors", async () => {
    mocks.currentUser.mockResolvedValue(null);
    const result = await GET();
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ role: null });
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(result.headers.get("vary")).toBe("Cookie");
    expect(mocks.currentUser).toHaveBeenCalledTimes(1);
  });

  it.each(["CUSTOMER", "STORE", "DRIVER", "ADMIN", "SUPER_ADMIN", "PROMOTER"])(
    "preserves the server-validated session role for %s without revealing private profile data",
    async (role) => {
      mocks.currentUser.mockResolvedValue({
        id: "secure-account-id",
        name: "Private Account",
        email: "never-publish@example.test",
        role,
        status: "ACTIVE",
      });
      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ role });
      expect(JSON.stringify(body)).not.toContain("Private Account");
      expect(JSON.stringify(body)).not.toContain("never-publish");
      expect(response.headers.get("Cache-Control")).toContain("private");
    },
  );

  it("does not silently convert a session/database outage into a successful anonymous response", async () => {
    mocks.currentUser.mockRejectedValue(new Error("Database unavailable"));
    await expect(GET()).rejects.toThrow("Database unavailable");
  });
});
