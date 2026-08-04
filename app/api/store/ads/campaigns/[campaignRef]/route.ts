import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable, serverError, notFound } from "@/lib/api/response";
import { AdvertisingCampaignError, AdvertisingCampaignService } from "@/lib/advertising/campaign.service";
import { campaignUpdateInputSchema } from "@/lib/advertising/route-input";

export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  const store = await getStoreForUser(session.id);
  if (!store) return forbidden("No store found for this account.");

  try {
    const { campaignRef } = await params;
    const service = new AdvertisingCampaignService();
    const campaign = await service.getCampaignByRef(store.id, campaignRef);
    return ok(campaign);
  } catch (error: unknown) {
    if (error instanceof AdvertisingCampaignError && error.code === "CAMPAIGN_NOT_FOUND") return notFound("Campaign not found.");
    return serverError();
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  const store = await getStoreForUser(session.id);
  if (!store) return forbidden("No store found for this account.");

  try {
    const { campaignRef } = await params;
    const parsed = campaignUpdateInputSchema.safeParse(await request.json());
    if (!parsed.success) return unprocessable("Campaign input is invalid.");
    const service = new AdvertisingCampaignService();
    const campaign = await service.updateCampaign(store.id, campaignRef, parsed.data);
    return ok(campaign);
  } catch (error: unknown) {
    return unprocessable(error instanceof Error ? error.message : "Could not update campaign.");
  }
}
