import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { activateAdminCampaign } from "@/lib/promotions/admin-promotions.service";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/**
 * Activate approved campaign
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_MANAGE, { request });
  if (auth.response) return auth.response;

  try {
    const params = await context.params;
    assertPromotionsProductionReady("CAMPAIGN_ACTIVATE");
    const campaign = await activateAdminCampaign(params.reference);
    return NextResponse.json(campaign, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return errorResponse("Activate failed", 422);
  }
}
