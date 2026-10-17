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
import { DispatchPolicyError } from "@/lib/dispatch/automation-policy.service";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

const VALID_KEY = "recover-key-0001";

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/admin/dispatch/recover", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

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
      replayed: false,
      recoveredAt: "2026-10-17T07:00:00.000Z",
      actorUserId: "admin-1",
      idempotencyKey: VALID_KEY,
    });
  });

  it("enforces DISPATCH_MANAGE permission, origin and rate limiting before doing any work", async () => {
    const req = request({ bridgeId: "br-1", reason: "Cleared system lock", idempotencyKey: VALID_KEY });
    await postRecover(req);

    expect(mocks.enforceSameOriginRequest).toHaveBeenCalledTimes(1);
    expect(mocks.checkIpRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
      PERMISSIONS.DISPATCH_MANAGE,
      expect.objectContaining({ request: req })
    );
  });

  it("does not call the service when the permission check fails", async () => {
    const denied = new Response(null, { status: 403 });
    mocks.requireAdminApiPermission.mockResolvedValue({ user: null, response: denied });
    const res = await postRecover(request({ bridgeId: "br-1", reason: "x", idempotencyKey: VALID_KEY }));
    expect(res.status).toBe(403);
    expect(mocks.recoverExhaustedDispatchOrder).not.toHaveBeenCalled();
  });

  it("requires exactly one target identifier (rejects missing target)", async () => {
    const res = await postRecover(request({ reason: "Cleared system lock", idempotencyKey: VALID_KEY }));
    expect(res.status).toBe(422);
    expect(mocks.recoverExhaustedDispatchOrder).not.toHaveBeenCalled();
  });

  it("rejects requests with multiple target identifiers with 422", async () => {
    const res = await postRecover(
      request({
        bridgeId: "br-1",
        courierOrderId: "ord-1",
        reason: "Cleared system lock",
        idempotencyKey: VALID_KEY,
      })
    );
    expect(res.status).toBe(422);
    expect(mocks.recoverExhaustedDispatchOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["too short", "short"],
    ["illegal characters", "has spaces and !!"],
    ["too long", "k".repeat(129)],
  ])("rejects a %s idempotency key with 422 and never reaches the service", async (_label, key) => {
    const body: Record<string, unknown> = { bridgeId: "br-1", reason: "Cleared system lock" };
    if (key !== undefined) body.idempotencyKey = key;
    const res = await postRecover(request(body));
    expect(res.status).toBe(422);
    expect(mocks.recoverExhaustedDispatchOrder).not.toHaveBeenCalled();
  });

  it("calls the service with the authenticated actor and returns the result", async () => {
    const res = await postRecover(
      request({ bridgeId: "br-1", reason: "Cleared system lock", idempotencyKey: VALID_KEY })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ status: "RECOVERED", replayed: false });
    expect(mocks.recoverExhaustedDispatchOrder).toHaveBeenCalledWith({
      bridgeId: "br-1",
      courierOrderId: undefined,
      marketplaceStoreOrderId: undefined,
      actorUserId: "admin-1",
      reason: "Cleared system lock",
      policyReference: undefined,
      idempotencyKey: VALID_KEY,
    });
  });

  it.each([
    ["DISPATCH_RECOVERY_STATE_CONFLICT", 409],
    ["DISPATCH_RECOVERY_IDEMPOTENCY_KEY_REUSED", 409],
    ["DISPATCH_RECOVERY_STORE_ORDER_NOT_READY", 409],
    ["DISPATCH_RECOVERY_NOT_FOUND", 404],
    ["DISPATCH_POLICY_UNAUTHORIZED_ACTOR", 400],
  ])("maps %s to HTTP %i", async (code, status) => {
    mocks.recoverExhaustedDispatchOrder.mockRejectedValue(new DispatchPolicyError(code, "details"));
    const res = await postRecover(
      request({ bridgeId: "br-1", reason: "Cleared system lock", idempotencyKey: VALID_KEY })
    );
    expect(res.status).toBe(status);
  });
});
