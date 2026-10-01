import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { updateAdminCampaign } from "@/lib/promotions/admin-promotions.service";

import { getAdminPromotionRecord } from "@/lib/client-platform/promotion-authoring.service";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

/**
 * View campaign detail with full evidence
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_READ, {
    request,
  });
  if (auth.response) return auth.response;

  try {
    const params = await context.params;
    const campaign = await getAdminPromotionRecord(auth.user, params.reference);
    return NextResponse.json(campaign, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return errorResponse("Not found", 404);
  }
}

/**
 * Update draft campaign version
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_MANAGE, {
    request,
  });
  if (auth.response) return auth.response;

  try {
    const params = await context.params;
    const body = await request.json();
    assertPromotionsProductionReady("CAMPAIGN_UPDATE");

    const campaign = await updateAdminCampaign(params.reference, body);
    return NextResponse.json(campaign, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return errorResponse("Update failed", 422);
  }
}
