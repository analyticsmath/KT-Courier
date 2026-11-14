/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { assertPromotionsProductionReady } from "./production-lock";
import { db } from "@/lib/db";
import { Prisma, PromotionReconciliationStatus } from "@prisma/client";
import { safeOperationalText } from "@/lib/operations/phase5-repository";
import { createHash, randomUUID } from "node:crypto";
import { couponData, PromotionDraftSchema, PromotionUpdateSchema, promotionDraftProjection, versionData } from "@/lib/client-platform/promotion-authoring.service";
import { recordBudgetMovement } from "./promotion-budget.service";

const adminCampaignProjectionInclude = { versions: { orderBy: { versionNumber: "desc" as const }, take: 1, include: { targets: true, codes: { select: { maskedDisplay: true } }, budget: true, _count: { select: { redemptions: true } } } } };

export async function listAdminPromotions() {
  const campaigns = await db.promotionCampaign.findMany({ include: adminCampaignProjectionInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  return campaigns.map(promotionDraftProjection);
}

export async function createAdminCampaign(raw: unknown, actorUserId: string) {
  return createPlatformCampaign(raw, actorUserId);
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

export async function getAdminCampaign(reference: string) {
  if (!reference?.trim() || reference.length > 200) throw new Error("Invalid campaign reference.");
  const campaign = await db.promotionCampaign.findUnique({ where: { publicReference: reference }, include: adminCampaignProjectionInclude });
  return campaign ? promotionDraftProjection(campaign) : null;
}

export async function updateAdminCampaign(reference: string, raw: unknown, actorUserId: string) {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  if (!reference?.trim() || reference.length > 200 || !actorUserId?.trim()) throw new Error("Invalid campaign action.");
  const { draft, expectedRevision } = PromotionUpdateSchema.parse(raw);
  const code = couponData(draft);
  const include = { versions: { orderBy: { versionNumber: "desc" as const }, take: 1, include: { targets: true, codes: { select: { maskedDisplay: true } }, budget: true, _count: { select: { redemptions: true } } } } };
  return db.$transaction(async tx => {
    const campaign = await tx.promotionCampaign.findFirst({ where: { publicReference: reference, ownerType: "PLATFORM" }, include });
    const version = campaign?.versions[0];
    if (!campaign || !version) throw new Error("Campaign not found.");
    await tx.$queryRaw`SELECT id FROM "PromotionCampaignVersion" WHERE id=${version.id} FOR UPDATE`;
    const current = await tx.promotionCampaignVersion.findUniqueOrThrow({ where: { id: version.id } });
    if (!["DRAFT", "REJECTED"].includes(current.status) || current.clientDraftRevision !== expectedRevision) throw new Error("Campaign changed; reload before editing.");
    const [productCount, categoryCount, nonDraftCodes, approvedBudget] = await Promise.all([
      tx.product.count({ where: { id: { in: draft.productIds } } }),
      tx.catalogCategory.count({ where: { id: { in: draft.categoryIds } } }),
      tx.promotionCode.count({ where: { campaignVersionId: version.id, status: { not: "DRAFT" } } }),
      tx.promotionBudget.findUnique({ where: { campaignVersionId: version.id }, select: { id: true } }),
    ]);
    if (productCount !== draft.productIds.length || categoryCount !== draft.categoryIds.length) throw new Error("PROMOTION_TARGET_SCOPE");
    if (nonDraftCodes || approvedBudget) throw new Error("A campaign with issued codes or an approved budget cannot be edited.");
    const targets = [...draft.productIds.map(id => ({ targetType: "PRODUCT" as const, targetReference: id })), ...draft.categoryIds.map(id => ({ targetType: "CATEGORY" as const, targetReference: id })), ...(draft.productIds.length || draft.categoryIds.length ? [] : [{ targetType: "ALL_ELIGIBLE_MARKETPLACE_LINES" as const, targetReference: "*" }])];
    await tx.promotionCampaignVersionTarget.deleteMany({ where: { campaignVersionId: version.id } });
    await tx.promotionCode.deleteMany({ where: { campaignVersionId: version.id, status: "DRAFT" } });
    await tx.promotionCampaignVersion.update({ where: { id: version.id }, data: { ...versionData(draft), status: "DRAFT", clientDraftRevision: { increment: 1 }, targets: { create: targets }, ...(code ? { codes: { create: code } } : {}) } });
    const updated = await tx.promotionCampaign.updateMany({ where: { id: campaign.id, status: current.status }, data: { name: draft.name, purpose: draft.description, status: "DRAFT" } });
    if (updated.count !== 1) throw new Error("Campaign changed; reload before editing.");
    if (current.status === "REJECTED") await tx.promotionStatusHistory.create({ data: { campaignVersionId: version.id, fromStatus: "REJECTED", toStatus: "DRAFT", actorUserId, reason: "Administrator revised rejected campaign", operationId: `promotion-revision:${randomUUID()}` } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "UPDATE", entityType: "PromotionCampaign", entityId: campaign.id, message: "Administrator updated platform promotion draft", metadata: { revision: expectedRevision + 1 } } });
    return promotionDraftProjection(await tx.promotionCampaign.findUniqueOrThrow({ where: { id: campaign.id }, include }));
  });
}

export async function submitAdminCampaign(reference: string, actorUserId: string) {
  assertPromotionsProductionReady("CAMPAIGN_SUBMIT");
  return transitionReviewCampaign(reference, actorUserId, "UNDER_REVIEW");
}

export async function approveAdminCampaign(reference: string, actorUserId: string) {
  assertPromotionsProductionReady("CAMPAIGN_APPROVE");
  return transitionReviewCampaign(reference, actorUserId, "APPROVED");
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

export async function rejectAdminCampaign(reference: string, reason: unknown, actorUserId: string) {
  assertPromotionsProductionReady("CAMPAIGN_UPDATE");
  if (typeof reason !== "string" || reason.trim().length < 10 || reason.length > 1000) throw new Error("A review reason of 10 to 1000 characters is required.");
  return transitionReviewCampaign(reference, actorUserId, "REJECTED", safeOperationalText(reason, 1000));
}

async function transitionReviewCampaign(reference: string, actorUserId: string, target: "UNDER_REVIEW" | "APPROVED" | "REJECTED", reason?: string) {
  if (!reference?.trim() || reference.length > 200 || !actorUserId?.trim()) throw new Error("Invalid campaign action.");
  return db.$transaction(async tx => {
    const campaign = await tx.promotionCampaign.findUnique({ where: { publicReference: reference }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
    const version = campaign?.versions[0];
    const expected = target === "UNDER_REVIEW" ? "DRAFT" : "UNDER_REVIEW";
    if (!campaign || !version || campaign.status !== expected || version.status !== expected) throw new Error("Campaign is not in an actionable state.");
    if (target !== "REJECTED" && version.endsAt <= new Date()) throw new Error("An expired campaign cannot be submitted or approved.");
    if (target !== "UNDER_REVIEW" && (!version.submittedByUserId || version.submittedByUserId === actorUserId)) throw new Error("A different administrator must review this campaign.");
    const now = new Date();
    const changes = target === "UNDER_REVIEW" ? { submittedAt: now, submittedByUserId: actorUserId, rejectionReason: null, rejectedAt: null, rejectedByUserId: null } : target === "APPROVED" ? { approvedAt: now, approvedByUserId: actorUserId } : { rejectedAt: now, rejectedByUserId: actorUserId, rejectionReason: reason };
    const updated = await tx.promotionCampaignVersion.updateMany({ where: { id: version.id, status: expected, clientDraftRevision: version.clientDraftRevision }, data: { ...changes, status: target, clientDraftRevision: { increment: 1 } } });
    if (updated.count !== 1) throw new Error("Campaign changed; reload before acting.");
    const parent = await tx.promotionCampaign.updateMany({ where: { id: campaign.id, status: expected }, data: { status: target } });
    if (parent.count !== 1) throw new Error("Campaign changed; reload before acting.");
    const operationId = `promotion-review:${randomUUID()}`;
    await tx.promotionStatusHistory.create({ data: { campaignVersionId: version.id, fromStatus: expected, toStatus: target, actorUserId, reason: reason ?? `Administrator moved campaign to ${target}.`, operationId } });
    await tx.promotionEventIntent.create({ data: { eventType: `PROMOTION_${target}`, dedupeKey: operationId, payload: { campaignId: campaign.id, campaignVersionId: version.id } } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "STATUS_CHANGE", entityType: "PromotionCampaign", entityId: campaign.id, message: `Promotion campaign moved to ${target}.`, metadata: { fromStatus: expected, toStatus: target } } });
    return { reference: campaign.publicReference, status: target };
  });
}

export async function increaseAdminCampaignBudget(reference: string, amount: unknown, actorUserId: string, operationId: unknown) {
  assertPromotionsProductionReady("BUDGET_MOVEMENT");
  if (!reference?.trim() || reference.length > 200 || !actorUserId?.trim() || typeof amount !== "string" || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount) || typeof operationId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(operationId)) throw new Error("Invalid budget increase.");
  const value = new Prisma.Decimal(amount);
  if (value.lessThanOrEqualTo(0)) throw new Error("Budget increase must be positive.");
  const requestHash = createHash("sha256").update(JSON.stringify({ reference, actorUserId, amount: value.toFixed(2) })).digest("hex");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`promotion-budget:${operationId}`},0))::text`;
    const replay = await tx.promotionBudgetMovement.findUnique({ where: { operationId_movementType: { operationId, movementType: "APPROVED_INCREASE" } }, include: { budget: { include: { campaignVersion: { include: { campaign: true } } } } } });
    if (replay) {
      if (replay.requestHash !== requestHash || replay.budget.campaignVersion.campaign.publicReference !== reference) throw new Error("PROMOTION_BUDGET_OPERATION_CONFLICT");
      return { reference, amount: replay.amount.toFixed(2), balanceAfter: replay.balanceAfter.toFixed(2), operationId };
    }
    const campaign = await tx.promotionCampaign.findUnique({ where: { publicReference: reference }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { budget: true } } } });
    const version = campaign?.versions[0];
    if (!campaign || !version || !version.budget || !["APPROVED", "ACTIVE", "PAUSED"].includes(campaign.status) || campaign.status !== version.status || !version.approvedByUserId || !version.approvedAt) throw new Error("An independently approved campaign and budget are required.");
    await tx.$queryRaw`SELECT id FROM "PromotionCampaignVersion" WHERE id=${version.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "PromotionBudget" WHERE id=${version.budget.id} FOR UPDATE`;
    const current = await tx.promotionCampaignVersion.findUniqueOrThrow({ where: { id: version.id }, include: { campaign: true } });
    if (current.status !== campaign.status || current.campaign.status !== campaign.status || !current.approvedByUserId || !current.approvedAt) throw new Error("Campaign changed; reload before acting.");
    const movement = await recordBudgetMovement({ budgetId: version.budget.id, campaignVersionId: version.id, movementType: "APPROVED_INCREASE", amount: value, operationId, requestHash }, tx);
    await tx.adminActivityLog.create({ data: { actorUserId, action: "UPDATE", entityType: "PromotionCampaign", entityId: campaign.id, message: "Administrator increased approved promotion budget", metadata: { operationId, amount: value.toFixed(2) } } });
    return { reference, amount: value.toFixed(2), balanceAfter: movement.balanceAfter.toFixed(2), operationId };
  }, { isolationLevel: "ReadCommitted" });
}

export async function generateCodeBatch(...args: any[]): Promise<any> {
  assertPromotionsProductionReady("CODE_GENERATE");
  return null;
}

export async function getCampaignPerformance(reference: string) {
  const campaign = await findCampaignIdentity(reference);
  if (!campaign) return null;
  const groups = await db.promotionRedemption.groupBy({ by: ["status"], where: { campaignVersion: { campaignId: campaign.id } }, _count: { _all: true }, _sum: { discountAmount: true, platformFunding: true, storeFunding: true } });
  return { reference, statuses: groups.map(group => ({ status: group.status, count: group._count._all, grossDiscount: group._sum.discountAmount?.toFixed(2) ?? "0.00", grossPlatformFunding: group._sum.platformFunding?.toFixed(2) ?? "0.00", grossStoreFunding: group._sum.storeFunding?.toFixed(2) ?? "0.00" })) };
}

export async function getBudgetTracking(reference: string) {
  const campaign = await findCampaignIdentity(reference);
  if (!campaign) return null;
  const budgets = await db.promotionBudget.findMany({ where: { campaignVersion: { campaignId: campaign.id } }, include: { campaignVersion: { select: { publicReference: true, versionNumber: true } } }, orderBy: { campaignVersion: { versionNumber: "desc" } } });
  return { reference, budgets: budgets.map(budget => ({ versionReference: budget.campaignVersion.publicReference, versionNumber: budget.campaignVersion.versionNumber, status: budget.status, currency: budget.currency, approved: budget.approvedAmount.toFixed(2), reserved: budget.reservedAmount.toFixed(2), committed: budget.committedAmount.toFixed(2), released: budget.releasedAmount.toFixed(2), reversed: budget.reversedAmount.toFixed(2), available: budget.approvedAmount.minus(budget.reservedAmount).minus(budget.committedAmount).plus(budget.releasedAmount).plus(budget.reversedAmount).toFixed(2) })) };
}

export async function getDisputeLedger(reference: string) {
  const campaign = await findCampaignIdentity(reference);
  if (!campaign) return null;
  const cases = await db.promotionReconciliationCase.findMany({ where: { campaignVersion: { campaignId: campaign.id } }, select: reconciliationSelection, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  return { reference, cases };
}

export async function getAuditTrail(reference: string) {
  const campaign = await findCampaignIdentity(reference);
  if (!campaign) return null;
  const history = await db.promotionStatusHistory.findMany({ where: { campaignVersion: { campaignId: campaign.id } }, select: { fromStatus: true, toStatus: true, reason: true, actorUserId: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
  return { reference, history };
}

async function findCampaignIdentity(reference: string) {
  if (!reference?.trim() || reference.length > 200) throw new Error("Invalid campaign reference.");
  return db.promotionCampaign.findUnique({ where: { publicReference: reference }, select: { id: true } });
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
