import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { json, failure, mutation } from "@/lib/client-platform/api";
import { reviewBusinessPromotion } from "@/lib/client-platform/promotion-authoring.service";
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/promotions/[reference]/review">,
) {
  const auth = await requireAdminApiPermission(
    [PERMISSIONS.PROMOTIONS_APPROVE, PERMISSIONS.PROMOTIONS_REVIEW],
    { request: req },
  );
  if (auth.response) return auth.response;
  const body = await mutation(req, "admin-promotion-review");
  if ("response" in body) return body.response;
  try {
    return json(
      await reviewBusinessPromotion(
        auth.user,
        (await ctx.params).reference,
        body.body,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
