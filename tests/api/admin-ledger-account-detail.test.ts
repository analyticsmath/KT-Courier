import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/ledger-query.service", () => ({ getLedgerAccountDetail: mocks.detail }));

import * as route from "@/app/api/admin/ledger/accounts/[id]/route";

const request = (query = "") => new NextRequest(`http://localhost/api/admin/ledger/accounts/a${query}`);
const context = { params: Promise.resolve({ id: "a" }) };

beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "super" } }); mocks.detail.mockResolvedValue(null); });

describe("GET /api/admin/ledger/accounts/[id]", () => {
  it("fails closed on permission denial", async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "denied" }, { status: 403 }) });
    expect((await route.GET(request(), context)).status).toBe(403);
  });

  it("returns 404 for an inaccessible or missing account", async () => {
    expect((await route.GET(request(), context)).status).toBe(404);
  });

  it("rejects invalid entry pagination and returns a string projection", async () => {
    expect((await route.GET(request("?page=-1"), context)).status).toBe(400);
    mocks.detail.mockResolvedValue({ account: { id: "a", currentBalance: "12.00" }, entries: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    const response = await route.GET(request("?page=1"), context);
    expect(await response.json()).toMatchObject({ account: { currentBalance: "12.00" } });
  });

  it("exports no mutation handler", () => expect(route).not.toHaveProperty("PATCH"));
});

