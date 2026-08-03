import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { increaseAdminCampaignBudget } from "@/lib/promotions/admin-promotions.service";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/**
 * Increase campaign budget
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_BUDGET_MANAGE, { request });
  if (auth.response) return auth.response;

  try {
    const params = await context.params;
    const body = await request.json();
    assertPromotionsProductionReady("BUDGET_MOVEMENT");
    const budget = await increaseAdminCampaignBudget(params.reference, body.amount);
    return NextResponse.json(budget, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return errorResponse("Budget increase failed", 422);
  }
}
