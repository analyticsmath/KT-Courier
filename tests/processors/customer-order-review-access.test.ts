import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/notifications/customer-orders/[eventType]/route";
const mocks = vi.hoisted(() => ({ access: vi.fn(), permission: vi.fn(), transaction: vi.fn(), lock: vi.fn(), review: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: mocks.permission }));
vi.mock("@/lib/notifications/admin-api", async (original) => ({ ...await original<typeof import("@/lib/notifications/admin-api")>(), notificationAdminAccess: mocks.access }));
vi.mock("@/lib/notifications/customer-order-review", async (original) => ({ ...await original<typeof import("@/lib/notifications/customer-order-review")>(), reviewCustomerOrderNotification: mocks.review }));
const request = (body: unknown) => new Request("http://localhost:3000/api/admin/notifications/customer-orders/ORDER_CONFIRMED", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = { params: Promise.resolve({ eventType: "ORDER_CONFIRMED" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ user: { id: "authenticated-admin", role: "ADMIN" } });
  mocks.permission.mockResolvedValue(true);
  mocks.transaction.mockImplementation((callback) => callback({ $executeRaw: mocks.lock }));
  mocks.review.mockResolvedValue({ status: "APPROVED" });
});
describe("customer notification review access", () => {
  it("returns authentication or origin rejection without opening a transaction", async () => {
    mocks.access.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    expect((await POST(request({ action: "ACTIVATE_ROUTE" }), context)).status).toBe(401);
    expect(mocks.access).toHaveBeenCalledWith(expect.any(Request), "notification_template.read", true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("requires the permission belonging to the requested action", async () => {
    mocks.permission.mockResolvedValue(false);
    expect((await POST(request({ action: "ACTIVATE_ROUTE" }), context)).status).toBe(403);
    expect(mocks.permission).toHaveBeenCalledWith({ userId: "authenticated-admin", role: "ADMIN", permissionKey: "notification_route.activate" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([{ action: "UNRECOGNIZED" }, { action: "PUBLISH_TEMPLATE", actorUserId: "forged" }, {}])("rejects unbounded or spoofed requests: %j", async (body) => {
    expect((await POST(request(body), context)).status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("serializes review changes and uses the authenticated actor", async () => {
    expect((await POST(request({ action: "APPROVE_TEMPLATE" }), context)).status).toBe(200);
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.review).toHaveBeenCalledWith(expect.anything(), "ORDER_CONFIRMED", "APPROVE_TEMPLATE", "authenticated-admin");
  });
});
