import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  DeliveryReviewSchema,
  listDeliveryReviews,
  submitDeliveryReview,
} from "@/lib/client-platform/reviews.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
import { emitAdminAlertNonBlocking } from "@/lib/notifications/admin-alert-dispatch.service";
export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  try {
    return json({
      reviews: await listDeliveryReviews(
        u.id,
        req.nextUrl.searchParams.get("scope") === "STORE",
      ),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  if (u.role !== "CUSTOMER")
    return json({ error: "A customer account is required." }, 403);
  const b = await mutation(req, `review:${u.id}`);
  if ("response" in b) return b.response;
  const p = DeliveryReviewSchema.safeParse(b.body);
  if (!p.success)
    return json(
      {
        error: "Choose 1–5 stars and write a review of up to 2000 characters.",
      },
      422,
    );
  try {
    const created = await submitDeliveryReview(u.id, p.data);
    if (created.rating <= 2) {
      await emitAdminAlertNonBlocking({
        eventType: "LOW_RATED_REVIEW",
        aggregateReference: `delivery-review:${created.id}`,
        title: `Low-rated delivery review (${created.rating}/5)`,
        summary: `Customer submitted a ${created.rating}-star delivery review on order ${p.data.orderId}.`,
        adminPath: `/admin/driver-reviews?rating=${created.rating}`,
        relatedOrderId: p.data.orderId,
        metadata: { rating: created.rating, orderId: p.data.orderId },
      });
    }
    return json(created, 201);
  } catch (e) {
    return failure(e);
  }
}
