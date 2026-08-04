import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  const store = await getStoreForUser(session.id);
  if (!store) return forbidden("No store found for this account.");

  try {
    const { campaignRef } = await params;
    const service = new AdvertisingCampaignService();
    const result = await service.endCampaign(store.id, campaignRef);
    return ok(result);
  } catch (error: unknown) {
    return unprocessable(error instanceof Error ? error.message : "Could not end campaign.");
  }
}
