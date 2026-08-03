/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { assertPromotionsProductionReady } from "./production-lock";

export async function listAdminPromotions(...args: any[]): Promise<any> {
  return [];
}

export async function createAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_CREATE");
  return null;
}

export async function createPlatformCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_CREATE");
  return null;
}

export async function getAdminCampaign(...args: any[]): Promise<any> {
  return null;
}

export async function updateAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function submitAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_SUBMIT");
  return null;
}

export async function approveAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function activateAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_ACTIVATE");
  return null;
}

export async function pauseAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function resumeAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function endAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function rejectAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function increaseAdminCampaignBudget(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  return null;
}

export async function generateCodeBatch(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CODE_GENERATE");
  return null;
}

export async function getCampaignPerformance(...args: any[]): Promise<any> {
  return null;
}

export async function getBudgetTracking(...args: any[]): Promise<any> {
  return null;
}

export async function getDisputeLedger(...args: any[]): Promise<any> {
  return null;
}

export async function getAuditTrail(...args: any[]): Promise<any> {
  return null;
}

export async function listPromotionReconciliations(...args: any[]): Promise<any> {
  return [];
}

export async function getPromotionReconciliation(...args: any[]): Promise<any> {
  return null;
}

export async function monitorPromotionReconciliation(...args: any[]): Promise<any> {
  return null;
}

export async function resolvePromotionReconciliation(...args: any[]): Promise<any> {
  return null;
}
