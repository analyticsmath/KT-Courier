import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { json, failure, mutation } from "@/lib/client-platform/api";
import { submitBusinessPromotion } from "@/lib/client-platform/promotion-authoring.service";
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/store/promotions/[reference]/submit">,
) {
  const denied = await requireBusinessApi(
    "/api/store/promotions/[reference]/submit",
  );
  if (denied) return denied;
  const user = await getCurrentUser();
  if (!user) return json({ error: "Authentication required." }, 401);
  const body = await mutation(req, "promotion-draft-submit");
  if ("response" in body) return body.response;
  try {
    return json(
      await submitBusinessPromotion(
        user.id,
        (await ctx.params).reference,
        body.body,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
