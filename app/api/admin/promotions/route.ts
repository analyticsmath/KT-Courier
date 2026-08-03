import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { listAdminPromotions, createPlatformCampaign } from "@/lib/promotions/admin-promotions.service";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/**
 * List all promotion campaigns (platform + store)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_READ, { request });
  if (auth.response) return auth.response;

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const campaigns = await listAdminPromotions(searchParams);
    return NextResponse.json(campaigns, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return errorResponse("Could not load campaigns", 500);
  }
}

/**
 * Create platform campaign
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_MANAGE, { request });
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    assertPromotionsProductionReady("CAMPAIGN_CREATE");

    const campaign = await createPlatformCampaign(body);
    return NextResponse.json(campaign, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return errorResponse("Could not create campaign", 422);
  }
}
