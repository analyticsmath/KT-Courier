import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";

import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { pauseStoreCampaign } from "@/lib/promotions/store-promotions.service";

/**
 * Pause active store campaign
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/promotions/[reference]/pause",
  );
  if (workspaceDenied) return workspaceDenied;
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const store = await getStoreForUser(session.id, undefined, "marketing");
  if (!store) return forbidden("No store found for this account.");

  try {
    const params = await context.params;
    assertPromotionsProductionReady("CAMPAIGN_UPDATE");
    const campaign = await pauseStoreCampaign(store.id, params.reference);
    return ok(campaign);
  } catch {
    return unprocessable("Pause failed");
  }
}
