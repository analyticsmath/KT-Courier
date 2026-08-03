import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export async function hasRefundPagePermission(user: Readonly<{ id: string; role: "ADMIN" | "SUPER_ADMIN" }>, permissionKey: string): Promise<boolean> {
  const denied = await prisma.userPermission.findFirst({ where: { userId: user.id, effect: "DENY", permission: { key: permissionKey } }, select: { id: true } });
  if (denied) return false;
  return user.role === "SUPER_ADMIN" || hasPermission({ userId: user.id, role: user.role, permissionKey });
}

export async function requireRefundPagePermission(permissionKey: string) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) redirect("/login");
  if (!(await hasRefundPagePermission(user as any, permissionKey))) redirect("/");
  return user;
}

