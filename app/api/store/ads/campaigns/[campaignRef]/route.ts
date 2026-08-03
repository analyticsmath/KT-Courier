import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable, serverError, notFound } from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  try {
    const { campaignRef } = await params;
    const service = new AdvertisingCampaignService();
    const campaign = await service.getCampaignByRef(session.id, campaignRef);
    return ok(campaign);
  } catch (error: any) {
    if (error.code === "CAMPAIGN_NOT_FOUND") return notFound("Campaign not found.");
    return serverError();
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  try {
    const { campaignRef } = await params;
    const body = await request.json();
    const service = new AdvertisingCampaignService();
    const campaign = await service.updateCampaign(session.id, campaignRef, { name: body.name });
    return ok(campaign);
  } catch (error: any) {
    return unprocessable(error.message || "Could not update campaign.");
  }
}
