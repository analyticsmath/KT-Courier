import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  save: vi.fn(),
  origin: vi.fn(),
}));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.permission }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mocks.origin }));
vi.mock("@/lib/services/driver-engagement.service", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/services/driver-engagement.service")>();
  return { ...actual, setDriverEngagement: mocks.save };
});
import { PATCH } from "@/app/api/admin/drivers/[id]/engagement/route";

const entry = {
  engagementType: "FREELANCE", contractReference: "contract-accepted-2026-001",
  effectiveFrom: "2026-11-08", expectedRevision: 0,
  reason: "Verified agreement evidence was checked independently by driver operations.",
};
const request = (input: unknown) => new NextRequest("http://localhost/api/admin/drivers/synthetic/engagement", {
  method: "PATCH", headers: { origin: "http://localhost", "content-type": "application/json" },
  body: JSON.stringify(input),
});

describe("admin-only driver engagement classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.origin.mockResolvedValue(null);
    mocks.permission.mockResolvedValue({ user: { id: "admin-user", role: "ADMIN" } });
    mocks.save.mockResolvedValue({ type: "FREELANCE", reference: entry.contractReference, revision: 1 });
  });
  it("rejects an unauthorized actor before any driver contract write", async () => {
    mocks.permission.mockResolvedValueOnce({ response: Response.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await PATCH(request(entry), { params: Promise.resolve({ id: "synthetic" }) })).status).toBe(401);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("requires both driver profile update and driver status authorities", async () => {
    mocks.permission.mockResolvedValueOnce({ user: { id: "admin-user" } })
      .mockResolvedValueOnce({ response: Response.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await PATCH(request(entry), { params: Promise.resolve({ id: "synthetic" }) })).status).toBe(403);
    expect(mocks.permission).toHaveBeenNthCalledWith(1, PERMISSIONS.DRIVERS_UPDATE, expect.anything());
    expect(mocks.permission).toHaveBeenNthCalledWith(2, PERMISSIONS.DRIVERS_STATUS_MANAGE, expect.anything());
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("refuses forged engagement types or weak contract evidence", async () => {
    expect((await PATCH(request({ ...entry, engagementType: "PLATFORM_OWNER" }), { params: Promise.resolve({ id: "synthetic" }) })).status).toBe(422);
    expect((await PATCH(request({ ...entry, contractReference: "n/a" }), { params: Promise.resolve({ id: "synthetic" }) })).status).toBe(422);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("passes only validated contract input and actor identity", async () => {
    const response = await PATCH(request(entry), { params: Promise.resolve({ id: "synthetic" }) });
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith("synthetic", "admin-user", entry);
  });
});
