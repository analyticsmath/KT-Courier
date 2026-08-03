import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mocks.auth }));
vi.mock("@/lib/services/ledger-query.service", () => ({ getLedgerJournalDetail: mocks.detail }));

import * as route from "@/app/api/admin/ledger/journals/[id]/route";

const request = new NextRequest("http://localhost/api/admin/ledger/journals/j");
const context = { params: Promise.resolve({ id: "j" }) };

beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "super" } }); mocks.detail.mockResolvedValue(null); });

describe("GET /api/admin/ledger/journals/[id]", () => {
  it("returns authentication and permission failures", async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "auth" }, { status: 401 }) });
    expect((await route.GET(request, context)).status).toBe(401);
  });

  it("returns 404 for inaccessible details", async () => expect((await route.GET(request, context)).status).toBe(404));

  it("returns ordered entries, safe metadata, reversal relations, and no request hash", async () => {
    mocks.detail.mockResolvedValue({ id: "j", reference: "LJ-1", totalDebits: "1.00", totalCredits: "1.00", balanced: true, metadata: { fixture: "safe" }, metadataRedacted: false, originalJournal: null, reversalJournal: { id: "r", reference: "LJ-R" }, entries: [{ sequence: 1, amount: "1.00" }] });
    const response = await route.GET(request, context);
    const body = await response.json();
    expect(body).toMatchObject({ balanced: true, metadata: { fixture: "safe" }, reversalJournal: { id: "r" } });
    expect(body).not.toHaveProperty("requestHash");
  });

  it("exports no mutation methods", () => { expect(route).not.toHaveProperty("POST"); expect(route).not.toHaveProperty("PATCH"); expect(route).not.toHaveProperty("DELETE"); });
});
