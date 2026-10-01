import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  DeliveryReviewSchema,
  listDeliveryReviews,
  submitDeliveryReview,
} from "@/lib/client-platform/reviews.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
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
    return json(await submitDeliveryReview(u.id, p.data), 201);
  } catch (e) {
    return failure(e);
  }
}
