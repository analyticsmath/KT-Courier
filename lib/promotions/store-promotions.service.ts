import { assertPromotionsProductionReady } from "./production-lock";
import { transitionOwnedStoreCampaign } from "./admin-promotions.service";
import { storeAccess } from "@/lib/client-platform/store-access";
import { businessPromotionFinancialView, createBusinessPromotion, getBusinessPromotion, listBusinessPromotions, submitBusinessPromotion, updateBusinessPromotion } from "@/lib/client-platform/promotion-authoring.service";

export async function listStorePromotions(userId: string) { return listBusinessPromotions(userId); }
export async function createStoreCampaign(userId: string, draft: unknown) { assertPromotionsProductionReady("CAMPAIGN_CREATE"); return createBusinessPromotion(userId, draft); }
export async function getStoreCampaign(userId: string, reference: string) { return getBusinessPromotion(userId, reference); }
export async function updateStoreCampaign(userId: string, reference: string, draft: unknown) { assertPromotionsProductionReady("CAMPAIGN_UPDATE"); return updateBusinessPromotion(userId, reference, draft); }
export async function submitStoreCampaign(userId: string, reference: string, input: unknown) { assertPromotionsProductionReady("CAMPAIGN_SUBMIT"); return submitBusinessPromotion(userId, reference, input); }

async function transitionStoreCampaign(storeId: string, reference: string, actorUserId: string, target: "PAUSED" | "ENDED") {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  const access = await storeAccess(actorUserId, "marketing");
  if (access.store.id !== storeId) throw new Error("Store promotion not found.");
  return transitionOwnedStoreCampaign(reference, actorUserId, storeId, target);
}
export async function pauseStoreCampaign(storeId: string, reference: string, actorUserId: string) { return transitionStoreCampaign(storeId, reference, actorUserId, "PAUSED"); }
export async function endStoreCampaign(storeId: string, reference: string, actorUserId: string) { return transitionStoreCampaign(storeId, reference, actorUserId, "ENDED"); }
export async function getCampaignBudget(userId: string, reference: string) { return (await businessPromotionFinancialView(userId, reference)).budget; }
export async function getCampaignRedemptions(userId: string, reference: string) { return (await businessPromotionFinancialView(userId, reference)).redemptions; }
