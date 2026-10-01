import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { json, failure, mutation } from "@/lib/client-platform/api";
import {
  listBusinessPromotions,
  createBusinessPromotion,
} from "@/lib/client-platform/promotion-authoring.service";
export async function GET() {
  const denied = await requireBusinessApi("/api/store/promotions");
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return json({ error: "Authentication required." }, 401);
  try {
    return json(await listBusinessPromotions(user.id));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const denied = await requireBusinessApi("/api/store/promotions");
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return json({ error: "Authentication required." }, 401);
  const body = await mutation(req, "promotion-draft-create");
  if ("response" in body) return body.response;
  try {
    return json(await createBusinessPromotion(user.id, body.body), 201);
  } catch (e) {
    return failure(e);
  }
}
