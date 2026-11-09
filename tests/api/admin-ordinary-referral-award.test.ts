import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({
  origin: vi.fn(), auth: vi.fn(), rate: vi.fn(), award: vi.fn(),
}));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: mock.origin }));
vi.mock("@/lib/auth/admin-api", () => ({ requireSuperAdminApi: mock.auth }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: mock.rate }));
vi.mock("@/lib/rewards/ordinary-referral-award.service", () => ({
  awardVerifiedOrdinaryReferral: mock.award,
  OrdinaryReferralAwardError: class OrdinaryReferralAwardError extends Error {
    constructor(readonly code: string, message: string) { super(message); }
  },
}));
import { POST } from "@/app/api/admin/referrals/[id]/award/route";

function request(body: unknown = { operationId: "award-operation-0001" }) {
  return new NextRequest("https://ktcouriers.com/api/admin/referrals/event-1/award", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://ktcouriers.com" },
    body: JSON.stringify(body),
  });
}
const context = (id = "event-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  mock.origin.mockResolvedValue(null);
  mock.auth.mockResolvedValue({ user: { id: "superadmin-1", role: "SUPER_ADMIN" } });
  mock.rate.mockResolvedValue({ ok: true });
  mock.award.mockResolvedValue({
    status: "CREDITED", referralEventId: "event-1", amountZar: "5.00",
    journalId: "j-1", journalReference: "LJ-1",
  });
});

describe("admin-only ordinary referral wallet issuance API", () => {
  it("enforces same-origin and superadmin authorization before any money call", async () => {
    mock.origin.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect((await POST(request(), context())).status).toBe(403);
    expect(mock.auth).not.toHaveBeenCalled();

    mock.auth.mockResolvedValueOnce({ response: new Response(null, { status: 403 }) });
    expect((await POST(request(), context())).status).toBe(403);
    expect(mock.award).not.toHaveBeenCalled();
  });

  it("posts only server-bound operator identity, with stable required idempotency operation ID", async () => {
    const response = await POST(request(), context());
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mock.award).toHaveBeenCalledExactlyOnceWith({
      referralEventId: "event-1", actorUserId: "superadmin-1",
      operationId: "award-operation-0001",
    });
    expect((await response.json()).releaseAuthorization).toBe(false);
  });

  it("returns an idempotent replay without duplicate funding", async () => {
    mock.award.mockResolvedValueOnce({ status: "REPLAYED", journalId: "j-1" });
    expect((await POST(request(), context())).status).toBe(200);
  });

  it("refuses malformed operations, injection and missing event identifiers", async () => {
    for (const body of [{}, { operationId: "x" }, { operationId: "award-operation-0001", customerId: "victim" }, []]) {
      expect((await POST(request(body), context())).status).toBe(422);
    }
    expect((await POST(request(), context(""))).status).toBe(422);
    expect(mock.award).not.toHaveBeenCalled();
  });

  it("fails closed under distributed rate-limit unavailability", async () => {
    mock.rate.mockResolvedValueOnce({ ok: false, failClosed: true });
    expect((await POST(request(), context())).status).toBe(503);
    expect(mock.award).not.toHaveBeenCalled();
  });

  it("does not disclose provider, customer or ledger internals on unexpected failure", async () => {
    mock.award.mockRejectedValueOnce(new Error("private bank account and customer details"));
    const response = await POST(request(), context());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private bank");
  });
});
