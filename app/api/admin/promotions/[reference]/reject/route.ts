import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { rejectAdminCampaign } from "@/lib/promotions/admin-promotions.service";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/**
 * Reject campaign version with reason
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_REVIEW, { request });
  if (auth.response) return auth.response;

  try {
    const params = await context.params;
    const body = await request.json();
    assertPromotionsProductionReady("CAMPAIGN_UPDATE");
    const campaign = await rejectAdminCampaign(params.reference, body.reason);
    return NextResponse.json(campaign, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return errorResponse("Reject failed", 422);
  }
}
