import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { PlatformError } from "./contracts";
import { storeAccess } from "./store-access";
export const DeliveryReviewSchema = z
  .object({
    orderId: z.string().cuid(),
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(3).max(2000),
  })
  .strict();
export const ReviewResponseSchema = z
  .object({ response: z.string().trim().min(3).max(2000) })
  .strict();
export async function submitDeliveryReview(
  userId: string,
  input: z.infer<typeof DeliveryReviewSchema>,
) {
  input = DeliveryReviewSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        customerId: userId,
        status: { in: ["DELIVERED", "COMPLETED"] },
      },
      select: { id: true, storeId: true },
    });
    if (!order)
      throw new PlatformError(
        "REVIEW_NOT_ELIGIBLE",
        "You can review your completed deliveries.",
        403,
      );
    return tx.deliveryReview.create({
      data: { ...input, authorUserId: userId, storeId: order.storeId },
      select: { id: true, rating: true, body: true, createdAt: true },
    });
  });
}
export async function listDeliveryReviews(userId: string, business = false) {
  const store = business ? (await storeAccess(userId, "reviews")).store : null;
  const rows = await prisma.deliveryReview.findMany({
    where: store ? { storeId: store.id } : { authorUserId: userId },
    select: {
      id: true,
      rating: true,
      body: true,
      response: true,
      createdAt: true,
      respondedAt: true,
      order: { select: { orderNumber: true } },
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    response: r.response,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
    orderNumber: r.order.orderNumber,
    authorName: r.author.name ?? "Customer",
  }));
}
export async function replyDeliveryReview(
  userId: string,
  id: string,
  response: string,
) {
  response = ReviewResponseSchema.parse({ response }).response;
  const store = (await storeAccess(userId, "reviews")).store;
  return prisma.$transaction(async (tx) => {
    const changed = await tx.deliveryReview.updateMany({
      where: { id, storeId: store.id },
      data: { response, respondedByUserId: userId, respondedAt: new Date() },
    });
    if (changed.count !== 1)
      throw new PlatformError("REVIEW_NOT_FOUND", "Review not found.", 404);
    await tx.adminActivityLog.create({
      data: {
        actorUserId: userId,
        action: "UPDATE",
        entityType: "DeliveryReview",
        entityId: id,
        message: "Business replied to delivery review",
        metadata: { storeId: store.id },
      },
    });
    return { saved: true };
  });
}
