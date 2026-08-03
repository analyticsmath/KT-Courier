import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/ledger-query.service", () => ({ listLedgerAccounts: mocks.list }));

import * as route from "@/app/api/admin/ledger/accounts/route";

beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.list.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }); });

describe("GET /api/admin/ledger/accounts", () => {
  it.each([[401, "unauthenticated"], [403, "wrong role"], [403, "missing ledger.read"], [403, "explicit ledger.read DENY"]])("returns %s when %s", async (status) => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "denied" }, { status }) });
    expect((await route.GET(new NextRequest("http://localhost/api/admin/ledger/accounts"))).status).toBe(status);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("returns stable string-money account DTOs for an authorized admin or SUPER_ADMIN", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "a", currentBalance: "0.00", debitTotal: "0.00", creditTotal: "0.00", owner: { type: "PLATFORM", id: "platform", label: "KT Couriers platform" } }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    const response = await route.GET(new NextRequest("http://localhost/api/admin/ledger/accounts?status=ACTIVE&page=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [{ currentBalance: "0.00" }] });
  });

  it("rejects malformed filters and invalid pagination", async () => {
    expect((await route.GET(new NextRequest("http://localhost/api/admin/ledger/accounts?page=zero"))).status).toBe(400);
    expect((await route.GET(new NextRequest("http://localhost/api/admin/ledger/accounts?status=INVALID"))).status).toBe(400);
  });

  it("exports no write method", () => {
    expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("PATCH"); expect(route).not.toHaveProperty("DELETE");
  });
});

