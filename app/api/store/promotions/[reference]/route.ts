import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable, serverError } from "@/lib/api/response";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { getStoreCampaign, updateStoreCampaign } from "@/lib/promotions/store-promotions.service";

/**
 * View store campaign detail
 */
export async function GET(
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
    const campaign = await getStoreCampaign(store.id, params.reference);
    return ok(campaign);
  } catch {
    return serverError();
  }
}

/**
 * Update draft campaign version
 */
export async function PATCH(
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
    const body = await request.json();
    assertPromotionsProductionReady("CAMPAIGN_UPDATE");

    const campaign = await updateStoreCampaign(store.id, params.reference, body);
    return ok(campaign);
  } catch {
    return unprocessable("Update failed");
  }
}
