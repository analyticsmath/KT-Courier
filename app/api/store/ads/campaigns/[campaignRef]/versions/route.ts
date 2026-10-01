import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";

import { ok, unauthorized, forbidden, unprocessable } from "@/lib/api/response";
import { AdvertisingCampaignService } from "@/lib/advertising/campaign.service";
import { campaignVersionInputSchema } from "@/lib/advertising/route-input";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignRef: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/ads/campaigns/[campaignRef]/versions",
  );
  if (workspaceDenied) return workspaceDenied;
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const store = await getStoreForUser(session.id, undefined, "marketing");
  if (!store) return forbidden("No store found for this account.");

  try {
    const { campaignRef } = await params;
    const parsed = campaignVersionInputSchema.safeParse(await request.json());
    if (!parsed.success)
      return unprocessable("Campaign version input is invalid.");
    const body = parsed.data;
    const service = new AdvertisingCampaignService();
    const version = await service.createCampaignVersion(store.id, campaignRef, {
      sponsoredObjectType: body.sponsoredObjectType,
      sponsoredProductId: body.sponsoredProductId,
      sponsoredStoreId: body.sponsoredStoreId,
      placementDefinitionId: body.placementDefinitionId,
      rateCardVersionId: body.rateCardVersionId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      dailyBudget: body.dailyBudget,
      totalBudget: body.totalBudget,
      attributionWindowDays: body.attributionWindowDays,
      frequencyCapPerSession: body.frequencyCapPerSession,
      frequencyCapPerDay: body.frequencyCapPerDay,
      targetingPolicyVersion: body.targetingPolicyVersion,
      measurementPolicyVersion: body.measurementPolicyVersion,
      invalidTrafficPolicyVersion: body.invalidTrafficPolicyVersion,
      attributionPolicyVersion: body.attributionPolicyVersion,
      legalTermsVersion: body.legalTermsVersion,
      targets: body.targets,
      creative: body.creative,
    });
    return ok(version);
  } catch (error: unknown) {
    return unprocessable(
      error instanceof Error
        ? error.message
        : "Could not create campaign version.",
    );
  }
}
