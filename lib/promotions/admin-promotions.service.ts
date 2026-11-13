/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { assertPromotionsProductionReady } from "./production-lock";
import { db } from "@/lib/db";
import { PromotionReconciliationStatus } from "@prisma/client";

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

const reconciliationSelection = {
  publicReference: true, reason: true, status: true, priority: true,
  safeSummary: true, createdAt: true, updatedAt: true, resolvedAt: true,
} as const;

export async function listPromotionReconciliations(filters: { status?: string } = {}) {
  const status = filters.status;
  if (status && !Object.values(PromotionReconciliationStatus).includes(status as PromotionReconciliationStatus)) throw new Error("INVALID_RECONCILIATION_STATUS");
  return db.promotionReconciliationCase.findMany({
    where: status ? { status: status as PromotionReconciliationStatus } : {},
    select: reconciliationSelection,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}

export async function getPromotionReconciliation(reference: string) {
  if (typeof reference !== "string" || reference.length === 0 || reference.length > 200) throw new Error("INVALID_RECONCILIATION_REFERENCE");
  return db.promotionReconciliationCase.findUnique({ where: { publicReference: reference }, select: reconciliationSelection });
}

export async function monitorPromotionReconciliation(...args: any[]): Promise<any> {
  return null;
}

export async function resolvePromotionReconciliation(...args: any[]): Promise<any> {
  return null;
}
