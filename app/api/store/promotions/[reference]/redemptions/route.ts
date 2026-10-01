import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { json, failure } from "@/lib/client-platform/api";
import { businessPromotionFinancialView } from "@/lib/client-platform/promotion-authoring.service";
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/store/promotions/[reference]/redemptions">,
) {
  const denied = await requireBusinessApi(
    "/api/store/promotions/[reference]/redemptions",
  );
  if (denied) return denied;
  const u = await getCurrentUser();
  if (!u) return json({ error: "Authentication required." }, 401);
  try {
    return json(
      (await businessPromotionFinancialView(u.id, (await ctx.params).reference))
        .redemptions,
    );
  } catch (e) {
    return failure(e);
  }
}
