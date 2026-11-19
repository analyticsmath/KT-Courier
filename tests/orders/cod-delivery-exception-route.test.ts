import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ auth: vi.fn(), report: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mock.auth }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: vi.fn(async () => null) }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: vi.fn(async () => ({ ok: true })), getClientIp: vi.fn(() => "127.0.0.1"), RATE_LIMITS: { ADMIN_DELIVERY_MANUAL: {} } }));
vi.mock("@/lib/services/cod-physical-delivery-exception.service", () => ({ CodPhysicalDeliveryExceptionError: class extends Error { constructor(public code: string, message: string) { super(message); } }, reportCodPhysicalDeliveryException: mock.report, reviewCodPhysicalDeliveryException: mock.review }));
import { POST } from "@/app/api/admin/orders/[id]/cod-delivery-exception/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
beforeEach(() => { vi.clearAllMocks(); mock.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN", status: "ACTIVE" } }); });
it("requires cash authority and forwards an evidence-backed report", async () => {
  mock.report.mockResolvedValue({ status: "REVIEW_PENDING", cashOutstanding: "12.00" });
  const req = new NextRequest("http://localhost/api/admin/orders/order/cod-delivery-exception", { method: "POST", body: JSON.stringify({ action: "REPORT", operationId: "operation-123", reason: "Delivery reported", evidenceReference: "POD-proof" }) });
  const res = await POST(req, { params: Promise.resolve({ id: "order" }) });
  expect(mock.auth).toHaveBeenCalledWith(PERMISSIONS.COD_OPERATIONS_MANAGE, expect.anything());
  expect(mock.report).toHaveBeenCalledWith(expect.objectContaining({ id: "admin" }), "order", expect.objectContaining({ evidenceReference: "POD-proof" }));
  expect(res.status).toBe(200);
});
it("rejects a report without its evidence reference", async () => {
  const req = new NextRequest("http://localhost/api/admin/orders/order/cod-delivery-exception", { method: "POST", body: JSON.stringify({ action: "REPORT", operationId: "operation-123", reason: "Delivery reported" }) });
  expect((await POST(req, { params: Promise.resolve({ id: "order" }) })).status).toBe(400);
  expect(mock.report).not.toHaveBeenCalled();
});
