import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/resend-otp/route";

const state = vi.hoisted(() => ({ lookup: vi.fn(), transaction: vi.fn(), deliver: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: state.lookup }, $transaction: state.transaction } }));
vi.mock("@/lib/notifications/security-email-delivery", () => ({ deliverSecurityEmail: state.deliver }));
vi.mock("@/lib/auth/security-email-readiness", async (original) => ({ ...await original<typeof import("@/lib/auth/security-email-readiness")>(), securityEmailUnavailableResponse: () => null }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: async () => null }));
vi.mock("@/lib/security/rate-limit", () => ({ checkAuthRateLimit: async () => ({ ok: true }), RATE_LIMITS: { RESEND_OTP: {} } }));
const request = () => new NextRequest("http://localhost:3000/api/auth/resend-otp", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ email: "synthetic@example.test" }) });

describe("production resend durable acceptance privacy", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "production"); state.transaction.mockResolvedValue({ deliveryId: "durable-delivery" }); });
  afterEach(() => vi.unstubAllEnvs());
  it.each([false, true])("returns identical pending replies when inline provider acceptance is %s", async (accepted) => {
    state.lookup.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "synthetic-user", status: "PENDING_VERIFICATION" });
    state.deliver.mockResolvedValue({ accepted });
    const absent = await POST(request()); const pending = await POST(request());
    expect(absent.status).toBe(202); expect(pending.status).toBe(202);
    expect(pending.headers.get("cache-control")).toBe("no-store");
    expect(await pending.json()).toEqual(await absent.json());
    expect(state.deliver).toHaveBeenCalledWith("durable-delivery");
    expect(state.transaction).toHaveBeenCalledTimes(1);
  });
  it("retains queued acceptance if the inline provider throws", async () => {
    state.lookup.mockResolvedValue({ id: "synthetic-user", status: "PENDING_VERIFICATION" }); state.deliver.mockRejectedValue(new Error("synthetic outage"));
    const response = await POST(request()); expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ deliveryPending: true });
  });
  it("reports persistence failure without attempting provider delivery", async () => {
    state.lookup.mockResolvedValue({ id: "synthetic-user", status: "PENDING_VERIFICATION" }); state.transaction.mockRejectedValue(new Error("synthetic persistence failure"));
    expect((await POST(request())).status).toBe(503); expect(state.deliver).not.toHaveBeenCalled();
  });
});
