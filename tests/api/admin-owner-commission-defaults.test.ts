import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), mutation: vi.fn(), prepare: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/commissions/admin-mutation-route", () => ({ prepareCommissionMutation: mocks.mutation }));
vi.mock("@/lib/commercial/owner-selected-commission-defaults", () => ({ prepareOwnerSelectedCommissionDefaults: mocks.prepare }));

import { POST } from "@/app/api/admin/commission-plans/owner-selected-defaults/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

function request(body: unknown = { confirmed: true }) {
  return new NextRequest("https://kt.example/api/admin/commission-plans/owner-selected-defaults", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "18" },
    body: JSON.stringify(body),
  });
}

async function post(body?: unknown) {
  const response = await POST(request(body));
  if (!response) throw new Error("Commission default preparation did not return a response.");
  return response;
}

describe("owner-approved commission default preparation API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "authorized-maker" } });
    mocks.mutation.mockResolvedValue({ body: { confirmed: true } });
    mocks.prepare.mockResolvedValue({ prepared: 2, preserved: 3, status: "DRAFT", independentReviewRequired: true });
  });

  it("requires commission management permission before preparation", async () => {
    mocks.auth.mockResolvedValue({ response: Response.json({ error: "Denied" }, { status: 403 }) });
    const response = await post();

    expect(response.status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith(PERMISSIONS.COMMISSION_PLANS_MANAGE, expect.anything());
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it.each([400, 403, 413, 429])("stops on a rejected request boundary (%i)", async (status) => {
    mocks.mutation.mockResolvedValue({ response: Response.json({ error: "Rejected" }, { status }) });

    expect((await post()).status).toBe(status);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation and never prepares from an unexpected body", async () => {
    mocks.mutation.mockResolvedValue({ body: { confirmed: false } });
    expect((await post({ confirmed: false })).status).toBe(422);
    mocks.mutation.mockResolvedValue({ body: { confirmed: true, actorUserId: "forged", approve: true } });
    expect((await post({ confirmed: true, actorUserId: "forged", approve: true })).status).toBe(422);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("uses the authenticated actor and returns only draft preparation counts without caching", async () => {
    const response = await post();

    expect(mocks.prepare).toHaveBeenCalledWith("authorized-maker");
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ prepared: 2, preserved: 3, status: "DRAFT", independentReviewRequired: true });
  });

  it("hides unexpected service errors", async () => {
    mocks.prepare.mockRejectedValue(new Error("private database detail"));
    const response = await post();

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database detail");
  });
});
