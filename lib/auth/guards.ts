import { redirect } from "next/navigation";
import { getCurrentUser } from "./current-user";
import { UserRole } from "@/types/db";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/types/domain";

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(
  ...allowed: UserRole[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) redirect("/login");
  return user;
}

export async function requireAdminPagePermission(
  permissionKey: string,
  redirectTo = "/"
): Promise<AuthenticatedUser> {
  const user = await requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);
  const allowed = await hasPermission({
    userId: user.id,
    role: user.role,
    permissionKey,
  });

  if (!allowed) redirect(redirectTo);
  return user;
}
