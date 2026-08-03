import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { submitStoreCampaign } from "@/lib/promotions/store-promotions.service";

/**
 * Submit campaign for platform review
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden();

  try {
    const params = await context.params;
    assertPromotionsProductionReady("CAMPAIGN_SUBMIT");
    const campaign = await submitStoreCampaign(session.id, params.reference);
    return ok(campaign);
  } catch {
    return unprocessable("Submit failed");
  }
}
