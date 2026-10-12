import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationCentre, NotificationIndicator } from "@/components/notifications/NotificationCentre";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
const doubles = vi.hoisted(() => ({ user: vi.fn(), permission: vi.fn(), items: vi.fn(), count: vi.fn(), categories: vi.fn(), preferences: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: doubles.user }, notificationInboxItem: { findMany: doubles.items, count: doubles.count }, notificationCategory: { findMany: doubles.categories }, notificationPreference: { findMany: doubles.preferences } } }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: doubles.permission }));
beforeEach(() => {
  vi.resetAllMocks(); doubles.user.mockResolvedValue({ role: "CUSTOMER", status: "ACTIVE" }); doubles.permission.mockResolvedValue(true);
  doubles.items.mockResolvedValue([]); doubles.count.mockResolvedValue(0); doubles.categories.mockResolvedValue([]); doubles.preferences.mockResolvedValue([]);
});
describe("canonical inbox presentation permissions (mocked database)", () => {
  it("does not read or project an inbox or unread count after explicit read denial", async () => {
    doubles.permission.mockImplementation(async ({ permissionKey }: { permissionKey: string }) => permissionKey !== PERMISSIONS.NOTIFICATION_READ_OWN);
    const centre = await NotificationCentre({ userId: "owner" });
    expect(centre.props.children).toContain("do not have permission"); expect(await NotificationIndicator({ userId: "owner", href: "/account/notifications" })).toBeNull();
    expect(doubles.items).not.toHaveBeenCalled(); expect(doubles.count).not.toHaveBeenCalled(); expect(doubles.preferences).not.toHaveBeenCalled();
  });
  it("refuses an inactive recipient before checking permissions or reading messages", async () => {
    doubles.user.mockResolvedValue({ role: "DRIVER", status: "SUSPENDED" });
    await NotificationCentre({ userId: "owner" }); expect(doubles.permission).not.toHaveBeenCalled(); expect(doubles.items).not.toHaveBeenCalled();
  });
  it("keeps archived/expired/foreign messages out of the screen and does not read denied preferences", async () => {
    doubles.permission.mockImplementation(async ({ permissionKey }: { permissionKey: string }) => permissionKey !== PERMISSIONS.NOTIFICATION_MANAGE_OWN_PREFERENCES);
    await NotificationCentre({ userId: "owner" });
    expect(doubles.items).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerUserId: "owner", state: { not: "ARCHIVED" }, OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] } }));
    expect(doubles.preferences).not.toHaveBeenCalled(); expect(doubles.categories).not.toHaveBeenCalled();
  });
});
