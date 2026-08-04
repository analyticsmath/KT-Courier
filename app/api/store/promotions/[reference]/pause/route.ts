import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { pauseStoreCampaign } from "@/lib/promotions/store-promotions.service";

/**
 * Pause active store campaign
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden();

  const store = await getStoreForUser(session.id);
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
