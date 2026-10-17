import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApiPermission: vi.fn(),
  enforceSameOriginRequest: vi.fn(),
  checkIpRateLimit: vi.fn(),
  recoverExhaustedDispatchOrder: vi.fn(),
}));

vi.mock("@/lib/auth/admin-api", () => ({
  requireAdminApiPermission: mocks.requireAdminApiPermission,
}));
vi.mock("@/lib/security/request-origin", () => ({
  enforceSameOriginRequest: mocks.enforceSameOriginRequest,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkIpRateLimit: mocks.checkIpRateLimit,
  RATE_LIMITS: { DISPATCH_ASSIGN: { max: 30, windowMs: 600000 } },
  getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/services/marketplace-dispatch-eligibility.service", () => ({
  recoverExhaustedDispatchOrder: mocks.recoverExhaustedDispatchOrder,
}));
vi.mock("@/lib/dispatch/automation-policy.service", () => {
  class MockDispatchPolicyError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
      this.name = "DispatchPolicyError";
    }
  }
  return {
    DispatchPolicyError: MockDispatchPolicyError,
  };
});

import { POST as postRecover } from "@/app/api/admin/dispatch/recover/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

describe("Admin Dispatch Recovery API Route (app/api/admin/dispatch/recover)", () => {
  const adminUser = { id: "admin-1", role: "ADMIN" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceSameOriginRequest.mockResolvedValue(null);
    mocks.checkIpRateLimit.mockResolvedValue({ ok: true });
    mocks.requireAdminApiPermission.mockResolvedValue({ user: adminUser, response: null });
    mocks.recoverExhaustedDispatchOrder.mockResolvedValue({
      bridgeId: "br-1",
      courierOrderId: "ord-1",
      status: "RECOVERED",
      recoveredAt: "2026-10-17T07:00:00.000Z",
      actorUserId: "admin-1",
    });
  });

  it("enforces DISPATCH_MANAGE permission", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/dispatch/recover", {
      method: "POST",
      body: JSON.stringify({
        bridgeId: "br-1",
        reason: "Cleared system lock",
      }),
    });

    await postRecover(req);

    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      PERMISSIONS.DISPATCH_MANAGE,
      expect.objectContaining({ request: req })
    );
  });

  it("validates request body requires at least one target identifier", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/dispatch/recover", {
      method: "POST",
      body: JSON.stringify({
        reason: "Cleared system lock",
      }),
    });

    const res = await postRecover(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("Validation failed.");
  });

  it("calls recoverExhaustedDispatchOrder with actor and returns result", async () => {
    mocks.recoverExhaustedDispatchOrder.mockResolvedValue({
      bridgeId: "br-1",
      courierOrderId: "ord-1",
      status: "RECOVERED",
      recoveredAt: "2026-10-17T07:00:00.000Z",
      actorUserId: "admin-1",
      idempotencyKey: "idem-key-1",
    });

    const req = new NextRequest("http://localhost:3000/api/admin/dispatch/recover", {
      method: "POST",
      body: JSON.stringify({
        bridgeId: "br-1",
        reason: "Cleared system lock",
        idempotencyKey: "idem-key-1",
      }),
    });

    const res = await postRecover(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("RECOVERED");
    expect(mocks.recoverExhaustedDispatchOrder).toHaveBeenCalledWith({
      bridgeId: "br-1",
      courierOrderId: undefined,
      marketplaceStoreOrderId: undefined,
      actorUserId: "admin-1",
      reason: "Cleared system lock",
      policyReference: undefined,
      idempotencyKey: "idem-key-1",
    });
  });
});
