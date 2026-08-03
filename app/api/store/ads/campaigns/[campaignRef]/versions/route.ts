import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, unprocessable, serverError } from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignRef: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.STORE) return forbidden("This endpoint is for store accounts.");

  try {
    const { campaignRef } = await params;
    const body = await request.json();
    const service = new AdvertisingCampaignService();
    const version = await service.createCampaignVersion(session.id, campaignRef, {
      sponsoredObjectType: body.sponsoredObjectType,
      sponsoredProductId: body.sponsoredProductId,
      sponsoredStoreId: body.sponsoredStoreId,
      placementDefinitionId: body.placementDefinitionId,
      rateCardVersionId: body.rateCardVersionId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      dailyBudget: Number(body.dailyBudget),
      totalBudget: Number(body.totalBudget),
      attributionWindowDays: body.attributionWindowDays,
      frequencyCapPerSession: body.frequencyCapPerSession,
      frequencyCapPerDay: body.frequencyCapPerDay,
      targetingPolicyVersion: body.targetingPolicyVersion || "1.0",
      measurementPolicyVersion: body.measurementPolicyVersion || "1.0",
      invalidTrafficPolicyVersion: body.invalidTrafficPolicyVersion || "1.0",
      attributionPolicyVersion: body.attributionPolicyVersion || "1.0",
      legalTermsVersion: body.legalTermsVersion || "1.0",
      targets: body.targets || [],
      creative: body.creative
    });
    return ok(version);
  } catch (error: any) {
    return unprocessable(error.message || "Could not create campaign version.");
  }
}
