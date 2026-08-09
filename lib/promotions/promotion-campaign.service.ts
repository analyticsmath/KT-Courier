import { assertPromotionsProductionReady } from "./production-lock";

export async function createPromotionCampaign(input: unknown): Promise<unknown> {
  assertPromotionsProductionReady("CAMPAIGN_CREATE");
  void input;
  return null;
}

export async function updatePromotionCampaign(id: string, input: unknown): Promise<unknown> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  void id;
  void input;
  return null;
}
