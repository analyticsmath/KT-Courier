import { assertPromotionsProductionReady } from "./production-lock";

export async function createPromotionCampaign(input: any): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_CREATE");
  return null;
}

export async function updatePromotionCampaign(id: string, input: any): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}
