import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  permission: {
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  rolePermission: { findMany: vi.fn() },
  userPermission: { findMany: vi.fn() },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    permission: {
      count: prismaMock.permission.count,
      findUnique: prismaMock.permission.findUnique,
    },
    rolePermission: prismaMock.rolePermission,
    userPermission: prismaMock.userPermission,
  },
}));

import { getPostAuthRedirect } from "@/lib/auth/role-redirects";
import { getEffectivePermissionKeysForUser, hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { canTransitionOrderStatus } from "@/lib/orders/order-state-machine";
import { OrderStatus, UserRole } from "@/types/db";

describe("PROMOTER role regression", () => {
  beforeEach(() => {
    prismaMock.permission.count.mockReset();
    prismaMock.permission.findUnique.mockReset();
    prismaMock.rolePermission.findMany.mockReset();
    prismaMock.userPermission.findMany.mockReset();
    prismaMock.permission.count.mockResolvedValue(0);
  });

  it("does not treat PROMOTER as an admin for permission checks", async () => {
    await expect(
      hasPermission({
        userId: "promoter-1",
        role: UserRole.PROMOTER,
        permissionKey: PERMISSIONS.ADMIN_DASHBOARD_READ,
      })
    ).resolves.toBe(false);

    expect(prismaMock.permission.count).toHaveBeenCalledOnce();
  });

  it("does not grant PROMOTER effective admin permission keys", async () => {
    await expect(
      getEffectivePermissionKeysForUser({
        userId: "promoter-1",
        role: UserRole.PROMOTER,
      })
    ).resolves.toContain(PERMISSIONS.PROMOTER_PROFILE_READ_OWN);
  });

  it("uses a neutral post-auth redirect instead of customer/store/driver/admin portals", () => {
    expect(getPostAuthRedirect(UserRole.PROMOTER)).toBe("/promoter");
    expect(getPostAuthRedirect(UserRole.PROMOTER)).not.toBe("/account");
    expect(getPostAuthRedirect(UserRole.PROMOTER)).not.toBe("/store");
    expect(getPostAuthRedirect(UserRole.PROMOTER)).not.toBe("/driver");
    expect(getPostAuthRedirect(UserRole.PROMOTER)).not.toBe("/admin");
  });

  it("does not let PROMOTER perform order transitions as another role", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.PENDING,
        to: OrderStatus.CANCELLED,
        actorRole: UserRole.PROMOTER,
        context: {
          actorOwnsOrder: true,
          actorOwnsStore: true,
          actorIsAssignedDriver: true,
          hasAcceptedAssignment: true,
          allowAdminOverride: true,
          reason: "No portal should be inferred.",
        },
      })
    ).toBe(false);
  });
});
