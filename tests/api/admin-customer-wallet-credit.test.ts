import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminWalletGrantError } from "@/lib/services/admin-customer-wallet-grant-policy";

const mocks = vi.hoisted(() => ({
  origin: vi.fn(), auth: vi.fn(), rate: vi.fn(), credit: vi.fn(),
}));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mocks.origin }));
vi.mock("@/lib/auth/admin-api", () => ({ requireSuperAdminApi: mocks.auth }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: mocks.rate }));
vi.mock("@/lib/services/admin-customer-wallet-grant.service", () => ({
  creditCustomerWalletBySuperAdmin: mocks.credit,
}));
import { POST } from "@/app/api/admin/users/[id]/wallet-credit/route";

const command = { amount: "50.00", reason: "Superuser-approved customer courtesy balance", operationId: "wallet-uuid-12345" };
const request = (value: unknown = command, contentType = "application/json") =>
  new NextRequest("https://ktcouriers.test/api/admin/users/customer-1/wallet-credit", {
    method: "POST",
    headers: { Origin: "https://ktcouriers.test", "Content-Type": contentType },
    body: JSON.stringify(value),
  });
const call = (requestValue: NextRequest) => POST(requestValue, { params: Promise.resolve({ id: "customer-1" }) });

describe("superadmin customer-wallet grant route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.origin.mockResolvedValue(null);
    mocks.auth.mockResolvedValue({ user: { id: "owner-1", role: "SUPER_ADMIN" }, response: null });
    mocks.rate.mockResolvedValue({ ok: true });
    mocks.credit.mockResolvedValue({
      journalReference: "LJ-123", journalId: "journal-1", customerUserId: "customer-1",
      amount: "50.00", availableBalanceAfter: "50.00", status: "CREDITED",
    });
  });

  it("rejects CSRF and non-superusers before any ledger action", async () => {
    mocks.origin.mockResolvedValueOnce(new Response("Invalid request origin", { status: 403 }));
    expect((await call(request())).status).toBe(403);
    mocks.auth.mockResolvedValueOnce({ response: new Response("Forbidden", { status: 403 }) });
    expect((await call(request())).status).toBe(403);
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("fails closed without the distributed rate limiter", async () => {
    mocks.rate.mockResolvedValueOnce({ ok: false, failClosed: true, retryAfterSeconds: 60 });
    const response = await call(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("rejects incorrect JSON content type, unknown fields and missing reason", async () => {
    expect((await call(request(command, "text/plain"))).status).toBe(415);
    expect((await call(request({ ...command, accountNumber: "secret" }))).status).toBe(422);
    expect((await call(request({ ...command, reason: "" }))).status).toBe(422);
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("passes one exact superadmin-owned grant to the financial journal", async () => {
    const response = await call(request());
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.credit).toHaveBeenCalledExactlyOnceWith({
      ...command, actorUserId: "owner-1", customerUserId: "customer-1",
    });
    expect((await response.json()).credit).toMatchObject({
      status: "CREDITED", availableBalanceAfter: "50.00",
    });
  });

  it("returns 200 on confirmed replay and 409 for mutated replay", async () => {
    mocks.credit.mockResolvedValueOnce({
      status: "REPLAYED", amount: "50.00", journalReference: "LJ-123",
    });
    expect((await call(request())).status).toBe(200);
    mocks.credit.mockRejectedValueOnce(Object.assign(new Error("idempotency conflict"), {
      code: "LEDGER_IDEMPOTENCY_CONFLICT",
    }));
    const conflict = await call(request());
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toMatch(/operation identifier/i);
  });

  it("refuses inactive or non-customer recipients, without leaking internals", async () => {
    mocks.credit.mockRejectedValueOnce(
      new AdminWalletGrantError("CUSTOMER_NOT_FOUND", "An active customer is required."),
    );
    expect((await call(request())).status).toBe(404);
    mocks.credit.mockRejectedValueOnce(new Error("database credentials or payment internals"));
    const response = await call(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("database credentials");
  });
});
