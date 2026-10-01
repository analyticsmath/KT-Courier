import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { json, failure, mutation } from "@/lib/client-platform/api";
import {
  getBusinessPromotion,
  updateBusinessPromotion,
} from "@/lib/client-platform/promotion-authoring.service";
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/store/promotions/[reference]">,
) {
  const denied = await requireBusinessApi("/api/store/promotions/[reference]");
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return json({ error: "Authentication required." }, 401);
  try {
    return json(
      await getBusinessPromotion(user.id, (await ctx.params).reference),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/store/promotions/[reference]">,
) {
  const denied = await requireBusinessApi("/api/store/promotions/[reference]");
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return json({ error: "Authentication required." }, 401);
  const body = await mutation(req, "promotion-draft-update");
  if ("response" in body) return body.response;
  try {
    return json(
      await updateBusinessPromotion(
        user.id,
        (await ctx.params).reference,
        body.body,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
