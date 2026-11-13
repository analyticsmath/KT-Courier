/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { assertPromotionsProductionReady } from "./production-lock";
import { db } from "@/lib/db";
import { PromotionReconciliationStatus } from "@prisma/client";
import { safeOperationalText } from "@/lib/operations/phase5-repository";

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

export async function monitorPromotionReconciliation(reference: string, actorUserId: string) {
  return transitionPromotionReconciliation({ reference, actorUserId, target: "MONITORING" });
}

export async function resolvePromotionReconciliation(reference: string, input: { resolutionNotes?: unknown }, actorUserId: string) {
  if (typeof input?.resolutionNotes !== "string" || input.resolutionNotes.trim().length < 10 || input.resolutionNotes.length > 1000) throw new Error("A resolution reason of 10 to 1000 characters is required.");
  return transitionPromotionReconciliation({ reference, actorUserId, target: "RESOLVED", notes: safeOperationalText(input.resolutionNotes, 1000) });
}

async function transitionPromotionReconciliation(input: { reference: string; actorUserId: string; target: "MONITORING" | "RESOLVED"; notes?: string }) {
  assertPromotionsProductionReady("RECONCILIATION");
  if (!input.reference?.trim() || input.reference.length > 200 || !input.actorUserId?.trim()) throw new Error("Invalid reconciliation action.");
  return db.$transaction(async (tx) => {
    const current = await tx.promotionReconciliationCase.findUnique({ where: { publicReference: input.reference } });
    if (!current || !["OPEN", "MONITORING"].includes(current.status)) throw new Error("Open reconciliation case not found.");
    if (input.target === "MONITORING" && current.status === "MONITORING") {
      return tx.promotionReconciliationCase.findUnique({ where: { id: current.id }, select: reconciliationSelection });
    }
    const changed = await tx.promotionReconciliationCase.updateMany({ where: { id: current.id, status: current.status }, data: input.target === "RESOLVED" ? { status: "RESOLVED", resolvedAt: new Date(), resolvedByUserId: input.actorUserId, resolutionNotes: input.notes } : { status: "MONITORING" } });
    if (changed.count !== 1) throw new Error("Reconciliation case changed; reload before acting.");
    await tx.adminActivityLog.create({ data: { actorUserId: input.actorUserId, action: "STATUS_CHANGE", entityType: "PromotionReconciliationCase", entityId: current.id, message: `Promotion reconciliation moved to ${input.target}.`, metadata: { fromStatus: current.status, toStatus: input.target } } });
    return tx.promotionReconciliationCase.findUnique({ where: { id: current.id }, select: reconciliationSelection });
  });
}
