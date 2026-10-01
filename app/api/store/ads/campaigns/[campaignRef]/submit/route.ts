import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";

import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignRef: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/ads/campaigns/[campaignRef]/submit",
  );
  if (workspaceDenied) return workspaceDenied;
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const store = await getStoreForUser(session.id, undefined, "marketing");
  if (!store) return forbidden("No store found for this account.");

  try {
    const { campaignRef } = await params;
    const service = new AdvertisingCampaignService();
    const result = await service.submitCampaignForReview(store.id, campaignRef);
    return ok(result);
  } catch (error: unknown) {
    return unprocessable(
      error instanceof Error
        ? error.message
        : "Could not submit campaign for review.",
    );
  }
}
