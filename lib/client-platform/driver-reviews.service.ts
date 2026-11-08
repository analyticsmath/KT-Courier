import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "./contracts";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/types/domain";

export const DriverReviewSchema = z.object({
  orderId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(3).max(2000),
}).strict();

/** Only the paying/delivery customer can rate the actual completed driver. */
export async function submitDriverReview(authorUserId: string, raw: z.input<typeof DriverReviewSchema>) {
  const input = DriverReviewSchema.parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`);
    const order = await tx.order.findFirst({
      where: { id: input.orderId, customerId: authorUserId, status: { in: ["DELIVERED", "COMPLETED"] } },
      select: { id: true },
    });
    if (!order) throw new PlatformError("DRIVER_REVIEW_NOT_ELIGIBLE",
      "Only the customer of a completed delivery may review its driver.", 403);
    const completed = await tx.orderAssignment.findMany({
      where: { orderId: order.id, status: "COMPLETED" },
      select: { driverProfileId: true }, take: 2,
    });
    if (completed.length !== 1) throw new PlatformError("DRIVER_REVIEW_DRIVER_UNVERIFIED",
      "The completing courier cannot be established from delivery records.", 409);
    const existing = await tx.driverReview.findUnique({ where: { orderId: order.id } });
    if (existing) throw new PlatformError("DRIVER_REVIEW_ALREADY_EXISTS",
      "This delivery already has a driver review.", 409);
    const created = await tx.driverReview.create({
      data: { orderId: order.id, authorUserId, driverProfileId: completed[0].driverProfileId,
        rating: input.rating, body: input.body },
      select: { id: true, rating: true, body: true, createdAt: true },
    });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listMyDriverReviewOpportunities(customerId: string) {
  const orders = await prisma.order.findMany({
    where: { customerId, status: { in: ["DELIVERED", "COMPLETED"] },
      driverReview: null, assignments: { some: { status: "COMPLETED" } } },
    select: { id: true, orderNumber: true,
      assignments: { where: { status: "COMPLETED" }, select: {
        driverProfileId: true, driverProfile: { select: { displayName: true, driverCode: true } },
      }, take: 2 } },
    orderBy: { createdAt: "desc" }, take: 30,
  });
  // Display no potentially incorrect driver when multiple completion claims exist.
  return orders.filter(order => order.assignments.length === 1).map(order => ({
    orderId: order.id, orderNumber: order.orderNumber,
    driverName: order.assignments[0].driverProfile.displayName ?? order.assignments[0].driverProfile.driverCode,
  }));
}

export async function listMyDriverReviews(customerId: string) {
  return prisma.driverReview.findMany({
    where: { authorUserId: customerId },
    select: { id: true, rating: true, body: true, createdAt: true,
      order: { select: { orderNumber: true } },
      driver: { select: { displayName: true, driverCode: true } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
}

export async function getAdminDriverReviewOverview(actor: AuthenticatedUser) {
  if (actor.status !== "ACTIVE" ||
      !["ADMIN", "SUPER_ADMIN"].includes(actor.role) ||
      !await hasPermission({ userId: actor.id, role: actor.role, permissionKey: "drivers.read" }) ||
      !await hasPermission({ userId: actor.id, role: actor.role, permissionKey: "orders.read" })) {
    throw new PlatformError("DRIVER_REVIEW_FORBIDDEN", "Driver and delivery records permission required.", 403);
  }
  const [summary, ratings, latest] = await Promise.all([
    prisma.driverReview.aggregate({ _count: { _all: true }, _avg: { rating: true } }),
    prisma.driverReview.groupBy({ by: ["driverProfileId"], _count: { _all: true },
      _avg: { rating: true }, orderBy: { _count: { driverProfileId: "desc" } }, take: 20 }),
    prisma.driverReview.findMany({ orderBy: { createdAt: "desc" }, take: 40,
      select: { id: true, rating: true, body: true, createdAt: true,
        order: { select: { orderNumber: true } },
        driver: { select: { id: true, driverCode: true, displayName: true } } } }),
  ]);
  const names = await prisma.driverProfile.findMany({ where: {
    id: { in: ratings.map(row => row.driverProfileId) } },
    select: { id: true, driverCode: true, displayName: true } });
  const byId = new Map(names.map(row => [row.id, row]));
  return {
    reviewCount: summary._count._all,
    average: summary._avg.rating == null ? null : Math.round(summary._avg.rating * 100) / 100,
    mostReviewed: ratings.map(row => ({
      driverId: row.driverProfileId,
      name: byId.get(row.driverProfileId)?.displayName ?? byId.get(row.driverProfileId)?.driverCode ?? "Driver unavailable",
      reviewCount: row._count._all,
      average: row._avg.rating == null ? null : Math.round(row._avg.rating * 100) / 100,
    })),
    recent: latest.map(row => ({
      id: row.id, rating: row.rating, body: row.body, at: row.createdAt.toISOString(),
      driverId: row.driver.id, driverName: row.driver.displayName ?? row.driver.driverCode,
      orderNumber: row.order.orderNumber,
    })),
  };
}
