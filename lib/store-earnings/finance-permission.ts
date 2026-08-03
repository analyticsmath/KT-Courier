import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { forbidden, unauthorized } from "@/lib/api/response";
import type { UserRole } from "@/types/db";

async function explicitlyDenied(userId: string, permissionKey: string): Promise<boolean> {
  return Boolean(await prisma.userPermission.findFirst({ where: { userId, effect: "DENY", permission: { key: permissionKey } }, select: { id: true } }));
}

export async function hasStoreEarningFinancePermission(user: Readonly<{ id: string; role: UserRole }>, permissionKey: string): Promise<boolean> {
  if (await explicitlyDenied(user.id, permissionKey)) return false;
  return hasPermission({ userId: user.id, role: user.role, permissionKey });
}

export async function requireStoreEarningFinanceApiPermission(permissionKey: string) {
  const user = await getCurrentUser();
  if (!user) return { response: unauthorized() } as const;
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") return { response: forbidden() } as const;
  if (!(await hasStoreEarningFinancePermission(user, permissionKey))) return { response: forbidden() } as const;
  return { user } as const;
}

export async function requireStoreEarningFinancePagePermission(permissionKey: string) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) redirect("/login");
  if (!(await hasStoreEarningFinancePermission(user, permissionKey))) redirect("/");
  return user;
}
