import { assertPromotionsProductionReady } from "./production-lock";
import { createBusinessPromotion, updateBusinessPromotion } from "@/lib/client-platform/promotion-authoring.service";

export async function createPromotionCampaign(input: { actorUserId: string; draft: unknown }) {
  assertPromotionsProductionReady("CAMPAIGN_CREATE");
  return createBusinessPromotion(input.actorUserId, input.draft);
}

export async function updatePromotionCampaign(input: { actorUserId: string; reference: string; draft: unknown }) {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return updateBusinessPromotion(input.actorUserId, input.reference, input.draft);
}
