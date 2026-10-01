import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ReviewResponseSchema,
  replyDeliveryReview,
} from "@/lib/client-platform/reviews.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function POST(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const b = await mutation(req, `review-response:${u.id}`);
  if ("response" in b) return b.response;
  const p = ReviewResponseSchema.safeParse(b.body);
  if (!p.success)
    return json({ error: "Write a response of 3–2000 characters." }, 422);
  try {
    return json(
      await replyDeliveryReview(u.id, (await c.params).id, p.data.response),
    );
  } catch (e) {
    return failure(e);
  }
}
