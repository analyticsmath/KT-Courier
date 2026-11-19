import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ auth: vi.fn(), complete: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireAdminApiPermission: mock.auth }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: vi.fn(async () => null) }));
vi.mock("@/lib/security/rate-limit", () => ({ checkIpRateLimit: vi.fn(async () => ({ ok: true })), getClientIp: vi.fn(() => "127.0.0.1"), RATE_LIMITS: { ADMIN_DELIVERY_MANUAL: {} } }));
vi.mock("@/lib/services/delivery-execution.service", () => ({ adminManualDeliveryComplete: mock.complete }));
vi.mock("@/lib/services/proof-of-delivery.service", () => ({ getAdminPodForOrder: vi.fn() }));
import { POST } from "@/app/api/admin/orders/[id]/proof-of-delivery/route";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

beforeEach(() => { vi.resetAllMocks(); mock.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN" } }); });
it("requires status-management permission and reports missing COD cash as a conflict", async () => {
  mock.complete.mockResolvedValue({ ok: false, code: "COD_COLLECTION_REQUIRED", error: "Record the required cash before completing delivery." });
  const request = new NextRequest("http://localhost/api/admin/orders/order/proof-of-delivery", { method: "POST", body: JSON.stringify({ recipientName: "Recipient", reason: "Recipient confirmed delivery manually" }) });
  const response = await POST(request, { params: Promise.resolve({ id: "order" }) });
  expect(mock.auth).toHaveBeenCalledWith(PERMISSIONS.ORDERS_STATUS_MANAGE, expect.anything());
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "COD_COLLECTION_REQUIRED" });
});
