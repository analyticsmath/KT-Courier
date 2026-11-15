import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { json, failure, mutation } from "@/lib/client-platform/api";
import {
  DriverReviewSchema, submitDriverReview,
  listMyDriverReviewOpportunities, listMyDriverReviews,
} from "@/lib/client-platform/driver-reviews.service";
import { emitAdminAlertNonBlocking } from "@/lib/notifications/admin-alert-dispatch.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sign in to view driver reviews." }, 401);
  if (user.role !== "CUSTOMER") return json({ error: "A customer account is required." }, 403);
  try {
    const [opportunities, reviews] = await Promise.all([
      listMyDriverReviewOpportunities(user.id), listMyDriverReviews(user.id),
    ]);
    return json({ opportunities, reviews });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sign in to review your delivery driver." }, 401);
  if (user.role !== "CUSTOMER") return json({ error: "Only the delivery customer can review the courier." }, 403);
  const mutationResult = await mutation(request, "driver-review:" + user.id);
  if ("response" in mutationResult) return mutationResult.response;
  const parsed = DriverReviewSchema.safeParse(mutationResult.body);
  if (!parsed.success) return json({ error: "Select 1–5 stars and a review of 3–2000 characters." }, 422);
  try {
    const review = await submitDriverReview(user.id, parsed.data);
    if (review.rating <= 2) {
      await emitAdminAlertNonBlocking({
        eventType: "LOW_RATED_REVIEW",
        aggregateReference: `driver-review:${review.id}`,
        title: `Low-rated driver review (${review.rating}/5)`,
        summary: `Customer submitted a ${review.rating}-star driver review on order ${parsed.data.orderId}.`,
        adminPath: `/admin/driver-reviews?rating=${review.rating}`,
        relatedOrderId: parsed.data.orderId,
        metadata: { rating: review.rating, orderId: parsed.data.orderId },
      });
    }
    return json({ review }, 201);
  }
  catch (error) { return failure(error); }
}
