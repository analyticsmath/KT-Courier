import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/types/domain";
import { PlatformError } from "./contracts";
import { storeAccess } from "./store-access";
export const SupportAccessSchema = z
  .object({
    storeId: z.string().cuid(),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
async function authorize(u: AuthenticatedUser) {
  if (
    u.role !== "SUPER_ADMIN" ||
    u.status !== "ACTIVE" ||
    !(await hasPermission({
      userId: u.id,
      role: u.role,
      permissionKey: "stores.read",
    }))
  )
    throw new PlatformError(
      "SUPPORT_ACCESS_FORBIDDEN",
      "Active super-admin access is required.",
      403,
    );
  // SUPER_ADMIN has global administrative defaults, but business support is
  // an explicitly constrained, audited capability. Honour its explicit DENY
  // on every grant and read, including a previously issued support session.
  if (await prisma.userPermission.findFirst({ where: { userId: u.id, effect: "DENY", permission: { key: "stores.read" } }, select: { id: true } })) {
    throw new PlatformError("SUPPORT_ACCESS_FORBIDDEN", "Business support access is denied.", 403);
  }
}
export async function grantBusinessSupportAccess(
  u: AuthenticatedUser,
  input: z.infer<typeof SupportAccessSchema>,
) {
  await authorize(u);
  input = SupportAccessSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    if (
      !(await tx.store.findUnique({
        where: { id: input.storeId },
        select: { id: true },
      }))
    )
      throw new PlatformError("BUSINESS_NOT_FOUND", "Business not found.", 404);
    const grant = await tx.businessSupportAccess.create({
      data: { ...input, actorUserId: u.id },
      select: { id: true, createdAt: true },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: u.id,
        action: "CREATE",
        entityType: "BusinessSupportAccess",
        entityId: grant.id,
        message: "Super-admin opened read-only business support dashboard",
        metadata: {
          storeId: input.storeId,
          reason: input.reason,
          expiresAt: new Date(
            grant.createdAt.getTime() + 15 * 60000,
          ).toISOString(),
        },
      },
    });
    return {
      id: grant.id,
      expiresAt: new Date(grant.createdAt.getTime() + 15 * 60000).toISOString(),
    };
  });
}
export async function readBusinessSupportDashboard(
  u: AuthenticatedUser,
  storeId: string,
  grantId: string,
) {
  await authorize(u);
  const grant = await prisma.businessSupportAccess.findFirst({
    where: {
      id: grantId,
      storeId,
      actorUserId: u.id,
      createdAt: { gte: new Date(Date.now() - 15 * 60000) },
    },
  });
  if (!grant)
    throw new PlatformError(
      "SUPPORT_ACCESS_EXPIRED",
      "Enter a reason to open a new 15-minute support session.",
      403,
    );
  const [store, orders, employees, reviews, marketing, contracts] =
    await Promise.all([
      prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          name: true,
          status: true,
          contactEmail: true,
          contactPhone: true,
          ownerUser: { select: { name: true, email: true } },
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { storeId },
        _count: { _all: true },
      }),
      prisma.storeEmployeeMembership.groupBy({
        by: ["status"],
        where: { storeId },
        _count: { _all: true },
      }),
      prisma.deliveryReview.aggregate({
        where: { storeId },
        _count: { id: true },
        _avg: { rating: true },
      }),
      prisma.managedMarketingRequest.groupBy({
        by: ["status"],
        where: { storeId },
        _count: { _all: true },
      }),
      prisma.subscriptionContract.findMany({
        where: { storeId },
        select: { publicReference: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
  if (!store)
    throw new PlatformError("BUSINESS_NOT_FOUND", "Business not found.", 404);
  return {
    store,
    grant: {
      id: grant.id,
      reason: grant.reason,
      actorUserId: u.id,
      actorName: u.name ?? u.email,
      createdAt: grant.createdAt.toISOString(),
      expiresAt: new Date(grant.createdAt.getTime() + 15 * 60000).toISOString(),
    },
    orders: orders.map((r) => ({ status: r.status, count: r._count._all })),
    employees: employees.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    reviews: { count: reviews._count.id, rating: reviews._avg.rating },
    marketing: marketing.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    contracts: contracts.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
export async function listBusinessSupportHistory(userId: string) {
  const a = await storeAccess(userId, "settings");
  return prisma.businessSupportAccess.findMany({
    where: { storeId: a.store.id },
    select: {
      id: true,
      reason: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
