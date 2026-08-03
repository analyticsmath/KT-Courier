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

  return projectProtectedNavigation(args.context, new Set(effectivePermissionKeys));
}
