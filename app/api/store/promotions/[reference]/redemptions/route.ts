import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";

import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getCampaignRedemptions } from "@/lib/promotions/store-promotions.service";

/**
 * View redemptions for store's campaign
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/promotions/[reference]/redemptions",
  );
  if (workspaceDenied) return workspaceDenied;
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const store = await getStoreForUser(session.id, undefined, "marketing");
  if (!store) return forbidden("No store found for this account.");

  try {
    const params = await context.params;
    const redemptions = await getCampaignRedemptions(
      store.id,
      params.reference,
    );
    return ok(redemptions);
  } catch {
    return serverError();
  }
}
