import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminApiPermission: vi.fn(),
  enforceSameOriginRequest: vi.fn(),
  checkIpRateLimit: vi.fn(),
  createDraft: vi.fn(),
  listPolicies: vi.fn(),
  submitPolicy: vi.fn(),
  approvePolicy: vi.fn(),
  rejectPolicy: vi.fn(),
  activatePolicy: vi.fn(),
  retirePolicy: vi.fn(),
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
vi.mock("@/lib/dispatch/automation-policy.service", () => {
  class MockDispatchPolicyError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
      this.name = "DispatchPolicyError";
    }
  }
  return {
    createDispatchAutomationPolicyDraft: mocks.createDraft,
    listDispatchAutomationPolicies: mocks.listPolicies,
    submitDispatchAutomationPolicy: mocks.submitPolicy,
    approveDispatchAutomationPolicy: mocks.approvePolicy,
    rejectDispatchAutomationPolicy: mocks.rejectPolicy,
    activateDispatchAutomationPolicy: mocks.activatePolicy,
    retireDispatchAutomationPolicy: mocks.retirePolicy,
    DispatchPolicyError: MockDispatchPolicyError,
  };
});

import { GET as getPolicies, POST as postPolicies } from "@/app/api/admin/dispatch/policies/route";
import { POST as postPolicyAction } from "@/app/api/admin/dispatch/policies/[id]/[action]/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

describe("Dispatch Automation Policy Admin API Routes", () => {
  const adminUser = { id: "admin-1", role: "ADMIN" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceSameOriginRequest.mockResolvedValue(null);
    mocks.checkIpRateLimit.mockResolvedValue({ ok: true });
    mocks.requireAdminApiPermission.mockResolvedValue({ user: adminUser, response: null });
  });

  describe("GET /api/admin/dispatch/policies", () => {
    it("requires DISPATCH_MANAGE permission and lists policies", async () => {
      mocks.listPolicies.mockResolvedValue([{ id: "pol-1", versionNumber: 1, status: "ACTIVE" }]);

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies");
      const res = await getPolicies(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.policies).toHaveLength(1);
      expect(mocks.requireAdminApiPermission).toHaveBeenCalledWith(
        PERMISSIONS.DISPATCH_MANAGE,
        expect.objectContaining({ request: req })
      );
    });

    it("blocks when admin permission check fails", async () => {
      mocks.requireAdminApiPermission.mockResolvedValue({
        user: null,
        response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      });

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies");
      const res = await getPolicies(req);

      expect(res.status).toBe(403);
      expect(mocks.listPolicies).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/dispatch/policies", () => {
    it("validates body and creates policy draft under PERMISSIONS.DISPATCH_MANAGE", async () => {
      mocks.createDraft.mockResolvedValue({
        id: "pol-new",
        publicReference: "dspauto_new",
        versionNumber: 2,
        status: "DRAFT",
      });

      const body = {
        versionNumber: 2,
        regionIds: ["reg-1"],
        maxOfferAttempts: 3,
        effectiveFrom: "2026-10-17T00:00:00.000Z",
      };

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const res = await postPolicies(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.policy.id).toBe("pol-new");
      expect(mocks.createDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          versionNumber: 2,
          regionIds: ["reg-1"],
          maxOfferAttempts: 3,
          createdByUserId: "admin-1",
        })
      );
    });

    it("returns 422 if body schema is invalid", async () => {
      const invalidBody = {
        versionNumber: -1,
        regionIds: [],
      };

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies", {
        method: "POST",
        body: JSON.stringify(invalidBody),
      });

      const res = await postPolicies(req);
      expect(res.status).toBe(422);
      expect(mocks.createDraft).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/dispatch/policies/[id]/[action]", () => {
    it("returns 404 for unsupported action", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies/dspauto_1/unknown", {
        method: "POST",
      });
      const res = await postPolicyAction(req, {
        params: Promise.resolve({ id: "dspauto_1", action: "unknown" }),
      });
      expect(res.status).toBe(404);
    });

    it("handles submit action", async () => {
      mocks.submitPolicy.mockResolvedValue({ id: "pol-1", status: "UNDER_REVIEW" });

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies/dspauto_1/submit", {
        method: "POST",
      });
      const res = await postPolicyAction(req, {
        params: Promise.resolve({ id: "dspauto_1", action: "submit" }),
      });

      expect(res.status).toBe(200);
      expect(mocks.submitPolicy).toHaveBeenCalledWith("dspauto_1", "admin-1");
    });

    it("handles approve action and returns 409 on self-approval conflict", async () => {
      const { DispatchPolicyError } = await import("@/lib/dispatch/automation-policy.service");
      mocks.approvePolicy.mockRejectedValue(
        new DispatchPolicyError("DISPATCH_POLICY_SELF_APPROVAL", "A policy cannot be approved by its author.")
      );

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies/dspauto_1/approve", {
        method: "POST",
      });
      const res = await postPolicyAction(req, {
        params: Promise.resolve({ id: "dspauto_1", action: "approve" }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/author/);
    });

    it("handles reject action with structured reason code", async () => {
      mocks.rejectPolicy.mockResolvedValue({ id: "pol-1", status: "REJECTED" });

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies/dspauto_1/reject", {
        method: "POST",
        body: JSON.stringify({ reasonCode: "REGION_SCOPE_UNACCEPTABLE" }),
      });
      const res = await postPolicyAction(req, {
        params: Promise.resolve({ id: "dspauto_1", action: "reject" }),
      });

      expect(res.status).toBe(200);
      expect(mocks.rejectPolicy).toHaveBeenCalledWith({
        publicReference: "dspauto_1",
        rejectedByUserId: "admin-1",
        reasonCode: "REGION_SCOPE_UNACCEPTABLE",
      });
    });

    it("handles activate action", async () => {
      mocks.activatePolicy.mockResolvedValue({ id: "pol-1", status: "ACTIVE" });

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies/dspauto_1/activate", {
        method: "POST",
      });
      const res = await postPolicyAction(req, {
        params: Promise.resolve({ id: "dspauto_1", action: "activate" }),
      });

      expect(res.status).toBe(200);
      expect(mocks.activatePolicy).toHaveBeenCalledWith({
        publicReference: "dspauto_1",
        activatedByUserId: "admin-1",
      });
    });

    it("handles retire action", async () => {
      mocks.retirePolicy.mockResolvedValue({ id: "pol-1", status: "RETIRED" });

      const req = new NextRequest("http://localhost:3000/api/admin/dispatch/policies/dspauto_1/retire", {
        method: "POST",
      });
      const res = await postPolicyAction(req, {
        params: Promise.resolve({ id: "dspauto_1", action: "retire" }),
      });

      expect(res.status).toBe(200);
      expect(mocks.retirePolicy).toHaveBeenCalledWith("dspauto_1", "admin-1");
    });
  });
});
