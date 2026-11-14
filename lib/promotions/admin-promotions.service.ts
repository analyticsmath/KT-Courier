/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { assertPromotionsProductionReady } from "./production-lock";
import { db } from "@/lib/db";
import { PromotionReconciliationStatus } from "@prisma/client";
import { safeOperationalText } from "@/lib/operations/phase5-repository";
import { createHash, randomUUID } from "node:crypto";
import { couponData, PromotionDraftSchema, promotionDraftProjection, versionData } from "@/lib/client-platform/promotion-authoring.service";

export async function listAdminPromotions(...args: any[]): Promise<any> {
  return [];
}

export async function createAdminCampaign(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CAMPAIGN_CREATE");
  return null;
}

export async function createPlatformCampaign(raw: unknown, actorUserId: string) {
  assertPromotionsProductionReady("CAMPAIGN_CREATE");
  if (!actorUserId?.trim()) throw new Error("An administrator is required.");
  const draft = PromotionDraftSchema.parse(raw);
  const code = couponData(draft);
  const internalCode = `PLATFORM_${draft.requestId}`;
  const requestHash = createHash("sha256").update(JSON.stringify({ ...draft, coupon: code?.codeHmac ?? null })).digest("hex");
  const include = { versions: { orderBy: { versionNumber: "desc" as const }, take: 1, include: { targets: true, codes: { select: { maskedDisplay: true } }, budget: true, _count: { select: { redemptions: true } } } } };
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${internalCode},0))`;
    const prior = await tx.promotionCampaign.findUnique({ where: { internalCode }, include });
    if (prior) {
      const receipt = await tx.adminActivityLog.findFirst({ where: { entityType: "PromotionCampaign", entityId: prior.id, actorUserId, metadata: { path: ["requestHash"], equals: requestHash } } });
      if (!receipt) throw new Error("PROMOTION_REPLAY_CONFLICT");
      return promotionDraftProjection(prior);
    }
    const [productCount, categoryCount] = await Promise.all([
      tx.product.count({ where: { id: { in: draft.productIds } } }),
      tx.catalogCategory.count({ where: { id: { in: draft.categoryIds } } }),
    ]);
    if (productCount !== draft.productIds.length || categoryCount !== draft.categoryIds.length) throw new Error("PROMOTION_TARGET_SCOPE");
    const targets = [
      ...draft.productIds.map(id => ({ targetType: "PRODUCT" as const, targetReference: id })),
      ...draft.categoryIds.map(id => ({ targetType: "CATEGORY" as const, targetReference: id })),
      ...(draft.productIds.length || draft.categoryIds.length ? [] : [{ targetType: "ALL_ELIGIBLE_MARKETPLACE_LINES" as const, targetReference: "*" }]),
    ];
    const campaign = await tx.promotionCampaign.create({ data: {
      publicReference: `PROMO_${randomUUID()}`, internalCode, ownerType: "PLATFORM", name: draft.name, purpose: draft.description,
      versions: { create: { ...versionData(draft), publicReference: `PV_${randomUUID()}`, versionNumber: 1, fundingType: "PLATFORM_FUNDED", platformFundingShareBps: 10000, storeFundingShareBps: 0, targets: { create: targets }, ...(code ? { codes: { create: code } } : {}), statusHistory: { create: { toStatus: "DRAFT", actorUserId, operationId: `platform-draft:${draft.requestId}`, reason: "Administrator created platform promotion draft" } } } },
    }, include });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "CREATE", entityType: "PromotionCampaign", entityId: campaign.id, message: "Administrator created platform promotion draft", metadata: { requestHash } } });
    return promotionDraftProjection(campaign);
  });
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

export async function activateAdminCampaign(reference: string, actorUserId: string) {
  return transitionActiveCampaign(reference, actorUserId, "ACTIVE", true);
}

export async function pauseAdminCampaign(reference: string, actorUserId: string) {
  return transitionActiveCampaign(reference, actorUserId, "PAUSED");
}

export async function resumeAdminCampaign(reference: string, actorUserId: string) {
  return transitionActiveCampaign(reference, actorUserId, "ACTIVE");
}

export async function endAdminCampaign(reference: string, actorUserId: string) {
  return transitionActiveCampaign(reference, actorUserId, "ENDED");
}

async function transitionActiveCampaign(reference: string, actorUserId: string, target: "ACTIVE" | "PAUSED" | "ENDED", activation = false) {
  assertPromotionsProductionReady(target === "ACTIVE" ? "CAMPAIGN_ACTIVATE" : "CAMPAIGN_UPDATE");
  if (!reference?.trim() || reference.length > 200 || !actorUserId?.trim()) throw new Error("Invalid campaign action.");
  return db.$transaction(async (tx) => {
    const campaign = await tx.promotionCampaign.findUnique({ where: { publicReference: reference }, include: { versions: { where: { status: { in: activation ? ["APPROVED", "ACTIVE", "PAUSED"] : ["ACTIVE", "PAUSED"] } }, include: { budget: true }, take: 2 } } });
    const allowed = activation ? ["APPROVED"] : target === "ACTIVE" ? ["PAUSED"] : target === "PAUSED" ? ["ACTIVE"] : ["ACTIVE", "PAUSED"];
    if (!campaign || campaign.versions.length !== 1 || !allowed.includes(campaign.status) || campaign.versions[0].status !== campaign.status) throw new Error("Campaign is not in an actionable state.");
    const version = campaign.versions[0];
    const now = new Date();
    if (target === "ACTIVE") {
      const budget = version.budget;
      if (!version.approvedByUserId || !version.approvedAt || (activation && version.approvedByUserId === actorUserId) || version.startsAt > now || version.endsAt <= now || !budget || budget.status !== "ACTIVE" || budget.currency !== version.currency || budget.approvedAmount.minus(budget.reservedAmount).minus(budget.committedAmount).plus(budget.releasedAmount).plus(budget.reversedAmount).lessThan("0.01")) throw new Error("Campaign approval, period or budget does not permit activation.");
    }
    const changed = await tx.promotionCampaignVersion.updateMany({ where: { id: version.id, status: version.status }, data: target === "ACTIVE" ? { status: target, pausedAt: null, ...(activation ? { activatedAt: now } : {}) } : target === "PAUSED" ? { status: target, pausedAt: now } : { status: target, endedAt: now } });
    if (changed.count !== 1) throw new Error("Campaign changed; reload before acting.");
    const parent = await tx.promotionCampaign.updateMany({ where: { id: campaign.id, status: campaign.status }, data: { status: target } });
    if (parent.count !== 1) throw new Error("Campaign changed; reload before acting.");
    const operationId = `promotion-admin:${randomUUID()}`;
    await tx.promotionStatusHistory.create({ data: { campaignVersionId: version.id, fromStatus: version.status, toStatus: target, actorUserId, reason: `Administrator ${activation ? "activated" : target === "ACTIVE" ? "resumed" : target === "PAUSED" ? "paused" : "ended"} the campaign.`, operationId } });
    await tx.promotionEventIntent.create({ data: { eventType: activation ? "PROMOTION_ACTIVATED" : target === "ACTIVE" ? "PROMOTION_RESUMED" : `PROMOTION_${target}`, dedupeKey: operationId, payload: { campaignId: campaign.id, campaignVersionId: version.id } } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "STATUS_CHANGE", entityType: "PromotionCampaign", entityId: campaign.id, message: `Promotion campaign moved to ${target}.`, metadata: { fromStatus: campaign.status, toStatus: target } } });
    return { reference: campaign.publicReference, status: target };
  });
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
