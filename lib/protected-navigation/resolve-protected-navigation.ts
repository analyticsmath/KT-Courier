import { prisma } from "@/lib/db/prisma";
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/db";
import {
  isProtectedContextAvailableToRole,
  projectProtectedNavigation,
  type ProtectedApplicationContext,
  type ProtectedNavigationProjection,
} from "./protected-navigation-registry";

/**
 * Server-only navigation projection. Permission keys are resolved here and are
 * deliberately not passed to the client navigation island.
 */
export async function getProtectedNavigationForUser(args: {
  userId: string;
  role: UserRole;
  context: ProtectedApplicationContext;
}): Promise<ProtectedNavigationProjection> {
  if (!isProtectedContextAvailableToRole(args.role, args.context)) {
    return { groups: [], mobileNavigation: [] };
  }

  const effectivePermissionKeys = await getEffectivePermissionKeysForUser({
    userId: args.userId,
    role: args.role,
  });

  const projection = projectProtectedNavigation(
    args.context,
    new Set(effectivePermissionKeys),
  );
  if (
    args.context === "CUSTOMER" &&
    (await prisma.storeEmployeeMembership.count({
      where: {
        userId: args.userId,
        status: "ACTIVE",
        store: { status: "ACTIVE" },
      },
    }))
  )
    projection.groups = [
      ...projection.groups,
      {
        id: "business",
        label: "Business",
        items: [
          {
            id: "employee-workspace",
            label: "Business workspace",
            href: "/store/workspace",
            icon: "store",
            group: "Business",
            contexts: ["CUSTOMER"],
          },
        ],
      },
    ];
  return projection;
}
