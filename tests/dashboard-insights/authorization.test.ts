import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), requireAdminPagePermission: vi.fn(), hasPermission: vi.fn(), count: vi.fn(), findMany: vi.fn(), dispatch: vi.fn(), exceptions: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requireRole: mocks.requireRole, requireAdminPagePermission: mocks.requireAdminPagePermission }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { order: { count: mocks.count, findMany: mocks.findMany }, store: { count: mocks.count }, deliveryRegion: { findMany: mocks.findMany } } }));
vi.mock("@/lib/services/admin-dispatch.service", () => ({ getDispatchBoardData: mocks.dispatch }));
vi.mock("@/lib/services/admin-pickup-operations.service", () => ({ listPickupExceptions: mocks.exceptions }));
vi.mock("@/lib/services/admin-delivery-exceptions.service", () => ({ listDeliveryExceptions: mocks.exceptions }));

import { getCustomerDashboardInsights } from "@/lib/dashboard-insights/customer-dashboard-insights";
import { getAdminDesk } from "@/lib/dashboard-insights/admin-desk";
import { getAdminDashboardInsights } from "@/lib/dashboard-insights/admin-dashboard-insights";

beforeEach(() => { vi.resetAllMocks(); mocks.count.mockResolvedValue(0); mocks.findMany.mockResolvedValue([]); });
describe("dashboard query authority", () => {
  it("scopes every customer count and selected date to the authenticated owner", async () => {
    mocks.requireRole.mockResolvedValue({ id: "owner-a", role: "CUSTOMER" });
    await getCustomerDashboardInsights("7_DAYS");
    for (const call of [...mocks.count.mock.calls, ...mocks.findMany.mock.calls]) expect(call[0].where.customerId).toBe("owner-a");
    expect(mocks.findMany.mock.calls[0][0].select).toEqual({ createdAt: true });
  });
  it("runs no queries when customer authentication fails", async () => {
    mocks.requireRole.mockRejectedValue(new Error("denied"));
    await expect(getCustomerDashboardInsights("TODAY")).rejects.toThrow("denied");
    expect(mocks.count).not.toHaveBeenCalled(); expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("does not query any domain for a dashboard-only admin", async () => {
    mocks.requireAdminPagePermission.mockResolvedValue({ id: "limited", role: "ADMIN" });
    mocks.hasPermission.mockResolvedValue(false);
    const result = await getAdminDesk("7_DAYS");
    expect(result.insight).toBeNull(); expect(result.dispatch).toBeNull(); expect(result.pendingStores).toBeNull();
    expect(mocks.count).not.toHaveBeenCalled(); expect(mocks.findMany).not.toHaveBeenCalled(); expect(mocks.dispatch).not.toHaveBeenCalled(); expect(mocks.exceptions).not.toHaveBeenCalled();
  });
  it("checks order access before querying admin aggregates", async () => {
    mocks.requireAdminPagePermission.mockResolvedValueOnce({ id: "limited", role: "ADMIN" }).mockRejectedValueOnce(new Error("order access denied"));
    await expect(getAdminDashboardInsights("TODAY")).rejects.toThrow("order access denied");
    expect(mocks.count).not.toHaveBeenCalled(); expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
