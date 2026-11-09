import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const mock = vi.hoisted(() => ({
  permission: vi.fn(), rate: vi.fn(), inspect: vi.fn(),
}));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mock.permission }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: mock.rate }));
vi.mock("@/lib/rewards/ordinary-referral-eligibility.service", () => ({
  inspectOrdinaryReferralEligibility: mock.inspect,
}));
import { GET } from "@/app/api/admin/referrals/[id]/eligibility/route";

const request = () => new NextRequest("https://ktcouriers.com/api/admin/referrals/event-1/eligibility");
const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe("read-only ordinary referral eligibility in finance and customer admin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.permission.mockResolvedValue({ user: { id: "admin-1" }, response: null });
    mock.rate.mockResolvedValue({ ok: true });
    mock.inspect.mockResolvedValue({
      referralEventId: "event-1", eligible: false, reason: "NO_SUCCESSFUL_PAYMENT",
      qualifyingPaymentId: null, evidenceStatus: null,
    });
  });

  it("requires BOTH customer identity and finance access before any lookup", async () => {
    mock.permission.mockResolvedValueOnce({ response: new Response(null, { status: 403 }) });
    expect((await GET(request(), context("event-1"))).status).toBe(403);
    expect(mock.permission).toHaveBeenCalledTimes(1);
    expect(mock.inspect).not.toHaveBeenCalled();

    mock.permission.mockResolvedValueOnce({ user: { id: "admin-1" }, response: null })
      .mockResolvedValueOnce({ response: new Response(null, { status: 403 }) });
    expect((await GET(request(), context("event-1"))).status).toBe(403);
    expect(mock.permission).toHaveBeenLastCalledWith(PERMISSIONS.FINANCE_READ, expect.objectContaining({ request: expect.anything() }));
    expect(mock.inspect).not.toHaveBeenCalled();
  });

  it("returns only read-only evidence without posting money or authorizing launch", async () => {
    const res = await GET(request(), context("event-1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.designation ?? body.data?.designation).toBe("READ_ONLY_FINANCIAL_EVIDENCE");
    expect(body.releaseAuthorization ?? body.data?.releaseAuthorization).toBe(false);
    expect(body.walletCreditCreated ?? body.data?.walletCreditCreated).toBe(false);
    expect(mock.inspect).toHaveBeenCalledExactlyOnceWith("event-1");
    expect(mock.permission).toHaveBeenNthCalledWith(1, PERMISSIONS.CUSTOMERS_READ, expect.anything());
    expect(mock.permission).toHaveBeenNthCalledWith(2, PERMISSIONS.FINANCE_READ, expect.anything());
  });

  it("rejects an invalid event reference and rate limits sensitive evidence reads", async () => {
    expect((await GET(request(), context(""))).status).toBe(422);
    mock.rate.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 60 });
    expect((await GET(request(), context("event-1"))).status).toBe(429);
    expect(mock.inspect).not.toHaveBeenCalled();
  });

  it("does not leak internal database errors", async () => {
    mock.inspect.mockRejectedValueOnce(new Error("private internal connection error"));
    const response = await GET(request(), context("event-1"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private internal");
  });
});
