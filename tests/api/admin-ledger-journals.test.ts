import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/ledger-query.service", () => ({ listLedgerJournals: mocks.list }));

import * as route from "@/app/api/admin/ledger/journals/route";

beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "admin" } }); mocks.list.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }); });

describe("GET /api/admin/ledger/journals", () => {
  it("enforces ledger.read including explicit DENY", async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "denied" }, { status: 403 }) });
    expect((await route.GET(new NextRequest("http://localhost/api/admin/ledger/journals"))).status).toBe(403);
  });

  it("validates filters and date ranges", async () => {
    expect((await route.GET(new NextRequest("http://localhost/api/admin/ledger/journals?type=PAYMENT"))).status).toBe(400);
    expect((await route.GET(new NextRequest("http://localhost/api/admin/ledger/journals?from=2026-02-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z"))).status).toBe(400);
  });

  it("returns server-derived balancing with deterministic pagination", async () => {
    mocks.list.mockResolvedValue({ data: [{ id: "j", totalDebits: "5.00", totalCredits: "5.00", balanced: true }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    const response = await route.GET(new NextRequest("http://localhost/api/admin/ledger/journals?page=1"));
    expect(await response.json()).toMatchObject({ data: [{ balanced: true, totalDebits: "5.00" }] });
  });

  it("does not expose write methods", () => { expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("DELETE"); });
});

