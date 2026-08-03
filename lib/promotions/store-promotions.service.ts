/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { assertPromotionsProductionReady } from "./production-lock";

export async function listStorePromotions(...args: any[]): Promise<any> {
  return [];
}

export async function createStoreCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_CREATE");
  return null;
}

export async function getStoreCampaign(...args: any[]): Promise<any> {
  return null;
}

export async function updateStoreCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function submitStoreCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_SUBMIT");
  return null;
}

export async function pauseStoreCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function endStoreCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function getCampaignBudget(...args: any[]): Promise<any> {
  return null;
}

export async function getCampaignRedemptions(...args: any[]): Promise<any> {
  return null;
}
