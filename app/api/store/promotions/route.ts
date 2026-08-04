import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable, serverError } from "@/lib/api/response";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { listStorePromotions, createStoreCampaign } from "@/lib/promotions/store-promotions.service";

/**
 * List store's promotion campaigns
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  const store = await getStoreForUser(session.id);
  if (!store) return forbidden("No store found for this account.");

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const campaigns = await listStorePromotions(store.id, searchParams);
    return ok(campaigns);
  } catch {
    return serverError();
  }
}

/**
 * Create new store campaign
 */
export async function POST(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  const store = await getStoreForUser(session.id);
  if (!store) return forbidden("No store found for this account.");

  try {
    const body = await request.json();
    assertPromotionsProductionReady("CAMPAIGN_CREATE");

    const campaign = await createStoreCampaign({
      storeId: store.id,
      ...body
    });
    return ok(campaign);
  } catch {
    return unprocessable("Could not create campaign");
  }
}
