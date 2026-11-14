import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { expirePromotionCampaigns } from "@/lib/promotions/promotion-expiry-batch";
import { releaseCheckoutPromotions } from "@/lib/promotions/promotion-release.service";
import { recordBudgetMovement } from "@/lib/promotions/promotion-budget.service";
import { Decimal } from "@prisma/client/runtime/library";
import { expirePromotionReservations } from "@/lib/promotions/promotion-reservation-expiry-batch";
import { createReconciliationCase } from "@/lib/promotions/promotion-reconciliation.service";
import { scanPromotionBudgetReconciliation } from "@/lib/promotions/promotion-reconciliation-scan";
import { activateAdminCampaign, approveAdminCampaign, createPlatformCampaign, endAdminCampaign, generateCodeBatch, getAdminCampaign, getAuditTrail, getBudgetTracking, getCampaignPerformance, getDisputeLedger, increaseAdminCampaignBudget, listAdminPromotions, monitorPromotionReconciliation, pauseAdminCampaign, rejectAdminCampaign, resolvePromotionReconciliation, resumeAdminCampaign, submitAdminCampaign, updateAdminCampaign } from "@/lib/promotions/admin-promotions.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { createSession } from "@/lib/auth/session";

const marker = `promotion-expiry-${randomUUID()}`;
let campaignId = "";
let versionId = "";
let adminId = "";
let validated = false;
beforeAll(async () => {
  requireDisposableStoreSettlementDatabase(); validated = true;
  adminId = (await prisma.user.create({ data: { email: `${marker}@example.test`, role: "ADMIN", status: "ACTIVE" } })).id;
  const campaign = await prisma.promotionCampaign.create({ data: { publicReference: marker, internalCode: marker, ownerType: "PLATFORM", status: "ACTIVE", name: "Disposable expiry" } });
  campaignId = campaign.id;
  const version = await prisma.promotionCampaignVersion.create({ data: { publicReference: `${marker}-version`, campaignId, versionNumber: 1, status: "ACTIVE", applicationMethod: "AUTOMATIC", discountScope: "ORDER", discountMechanism: "FIXED_AMOUNT", fundingType: "PLATFORM_FUNDED", startsAt: new Date("2020-01-01"), endsAt: new Date("2020-01-02") } });
  versionId = version.id;
});
afterAll(async () => {
  if (!validated) return;
  // The guarded disposable database is removed by the enclosing runner.
  await prisma.$disconnect();
});

it("creates one platform draft under concurrent retries and rejects changed or foreign replays", async () => {
  const draft = { requestId: randomUUID(), name: "Platform discount", description: "A carefully bounded platform promotion", mechanism: "FIXED_AMOUNT", value: "10.00", proposedBudget: "100.00", startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2026-06-01T00:00:00.000Z", globalLimit: 10, perCustomerLimit: 1 };
  const [first, second] = await Promise.all([createPlatformCampaign(draft, adminId), createPlatformCampaign(draft, adminId)]);
  expect(first.reference).toBe(second.reference);
  expect(first.status).toBe("DRAFT");
  const stored = await prisma.promotionCampaign.findUniqueOrThrow({ where: { publicReference: first.reference }, include: { versions: { include: { targets: true, budget: true } } } });
  expect(stored.ownerType).toBe("PLATFORM");
  expect(stored.versions).toHaveLength(1);
  expect(stored.versions[0].fundingType).toBe("PLATFORM_FUNDED");
  expect(stored.versions[0].budget).toBeNull();
  expect(stored.versions[0].targets[0].targetType).toBe("ALL_ELIGIBLE_MARKETPLACE_LINES");
  expect((await getAdminCampaign(first.reference))?.reference).toBe(first.reference);
  expect((await listAdminPromotions()).some(row => row.reference === first.reference)).toBe(true);
  expect(await getCampaignPerformance(first.reference)).toEqual({ reference: first.reference, statuses: [] });
  expect(await getDisputeLedger(first.reference)).toEqual({ reference: first.reference, cases: [] });
  expect((await getAuditTrail(first.reference))?.history[0].toStatus).toBe("DRAFT");
  await expect(createPlatformCampaign({ ...draft, name: "Different discount" }, adminId)).rejects.toThrow("PROMOTION_REPLAY_CONFLICT");
  await expect(createPlatformCampaign(draft, "another-admin")).rejects.toThrow("PROMOTION_REPLAY_CONFLICT");
});

it("requires independent review and records a single campaign decision", async () => {
  const reviewer = await prisma.user.create({ data: { email: `${marker}-reviewer@example.test`, role: "ADMIN", status: "ACTIVE" } });
  const draft = { requestId: randomUUID(), name: "Reviewable discount", description: "A bounded campaign for independent review", mechanism: "FIXED_AMOUNT", value: "10.00", proposedBudget: "100.00", startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 86400_000).toISOString(), globalLimit: 10, perCustomerLimit: 1 };
  const campaign = await createPlatformCampaign(draft, adminId);
  expect((await submitAdminCampaign(campaign.reference, adminId)).status).toBe("UNDER_REVIEW");
  await expect(approveAdminCampaign(campaign.reference, adminId)).rejects.toThrow("different administrator");
  const decisions = await Promise.allSettled([approveAdminCampaign(campaign.reference, reviewer.id), approveAdminCampaign(campaign.reference, reviewer.id)]);
  expect(decisions.filter(result => result.status === "fulfilled")).toHaveLength(1);
  const persisted = await prisma.promotionCampaign.findUniqueOrThrow({ where: { publicReference: campaign.reference }, include: { versions: { include: { budget: true, statusHistory: true } } } });
  expect(persisted.status).toBe("APPROVED");
  expect(persisted.versions[0].approvedByUserId).toBe(reviewer.id);
  expect(persisted.versions[0].budget).toBeNull();
  expect(persisted.versions[0].statusHistory.filter(row => row.toStatus === "APPROVED")).toHaveLength(1);
  const rejected = await createPlatformCampaign({ ...draft, requestId: randomUUID() }, adminId);
  await submitAdminCampaign(rejected.reference, adminId);
  await expect(rejectAdminCampaign(rejected.reference, "short", reviewer.id)).rejects.toThrow("review reason");
  expect((await rejectAdminCampaign(rejected.reference, "Does not meet the approved policy", reviewer.id)).status).toBe("REJECTED");
  const revisedDraft = { ...draft, requestId: randomUUID(), name: "Corrected discount" };
  const edits = await Promise.allSettled([updateAdminCampaign(rejected.reference, { draft: revisedDraft, expectedRevision: 2 }, adminId), updateAdminCampaign(rejected.reference, { draft: revisedDraft, expectedRevision: 2 }, adminId)]);
  expect(edits.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await prisma.promotionCampaign.findUniqueOrThrow({ where: { publicReference: rejected.reference } })).status).toBe("DRAFT");
  expect((await submitAdminCampaign(rejected.reference, adminId)).status).toBe("UNDER_REVIEW");
  const protectedDraft = await createPlatformCampaign({ ...draft, requestId: randomUUID() }, adminId);
  const protectedVersion = await prisma.promotionCampaignVersion.findFirstOrThrow({ where: { campaign: { publicReference: protectedDraft.reference } } });
  await prisma.promotionBudget.create({ data: { campaignVersionId: protectedVersion.id, approvedAmount: 100 } });
  await expect(updateAdminCampaign(protectedDraft.reference, { draft: revisedDraft, expectedRevision: 0 }, adminId)).rejects.toThrow("approved budget");
});

it("increases an approved budget once across retries and rejects conflicting operations", async () => {
  const reference = `${marker}-budget-approval`;
  const campaign = await prisma.promotionCampaign.create({ data: { publicReference: reference, internalCode: reference, ownerType: "PLATFORM", name: "Approved budget", status: "APPROVED" } });
  const version = await prisma.promotionCampaignVersion.create({ data: { publicReference: `${reference}-version`, campaignId: campaign.id, versionNumber: 1, status: "APPROVED", applicationMethod: "AUTOMATIC", discountScope: "ORDER", discountMechanism: "FIXED_AMOUNT", fundingType: "PLATFORM_FUNDED", startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01"), approvedByUserId: adminId, approvedAt: new Date() } });
  const budget = await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 100 } });
  const operationId = `budget-increase:${randomUUID()}`;
  const [first, replay] = await Promise.all([increaseAdminCampaignBudget(reference, "25.00", adminId, operationId), increaseAdminCampaignBudget(reference, "25", adminId, operationId)]);
  expect(first).toEqual(replay);
  expect((await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } })).approvedAmount.toFixed(2)).toBe("125.00");
  expect((await getBudgetTracking(reference))?.budgets[0]).toMatchObject({ approved: "125.00", available: "125.00" });
  expect(await prisma.promotionBudgetMovement.count({ where: { budgetId: budget.id, operationId } })).toBe(1);
  await expect(increaseAdminCampaignBudget(reference, "26", adminId, operationId)).rejects.toThrow("OPERATION_CONFLICT");
  await expect(increaseAdminCampaignBudget(reference, "25", "other-admin", operationId)).rejects.toThrow("OPERATION_CONFLICT");
});

it("generates a replayable coupon batch without storing plaintext and activates only draft codes", async () => {
  const previousKey = process.env.PROMOTION_CODE_HMAC_KEY;
  process.env.PROMOTION_CODE_HMAC_KEY = "disposable-test-coupon-key-with-adequate-entropy";
  try {
    const reviewer = await prisma.user.create({ data: { email: `${marker}-coupon-reviewer@example.test`, role: "ADMIN", status: "ACTIVE" } });
    const draft = { requestId: randomUUID(), name: "Coupon promotion", description: "Discount with a bounded coupon batch", mechanism: "FIXED_AMOUNT", value: "10.00", proposedBudget: "100.00", startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 86400_000).toISOString(), globalLimit: 10, perCustomerLimit: 1, coupon: "INITIALCODE" };
    const campaign = await createPlatformCampaign(draft, adminId);
    const operationId = `coupon-batch:${randomUUID()}`;
    const [batch, replay] = await Promise.all([generateCodeBatch(campaign.reference, 2, adminId, operationId), generateCodeBatch(campaign.reference, 2, adminId, operationId)]);
    expect(batch).toEqual(replay);
    expect(new Set(batch.codes).size).toBe(2);
    const stored = await prisma.promotionCodeBatch.findUniqueOrThrow({ where: { publicReference: batch.reference }, include: { codes: true } });
    expect(stored.codes).toHaveLength(2);
    expect(batch.codes.every(code => !JSON.stringify(stored).includes(code))).toBe(true);
    await expect(generateCodeBatch(campaign.reference, 3, adminId, operationId)).rejects.toThrow("OPERATION_CONFLICT");
    await expect(updateAdminCampaign(campaign.reference, { draft, expectedRevision: 0 }, adminId)).rejects.toThrow("issued codes");
    await prisma.promotionCode.update({ where: { id: stored.codes[0].id }, data: { status: "ARCHIVED" } });
    await submitAdminCampaign(campaign.reference, adminId);
    await approveAdminCampaign(campaign.reference, reviewer.id);
    const version = await prisma.promotionCampaignVersion.findFirstOrThrow({ where: { campaign: { publicReference: campaign.reference } } });
    await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 100 } });
    await activateAdminCampaign(campaign.reference, adminId);
    const states = await prisma.promotionCode.findMany({ where: { campaignVersionId: version.id }, select: { status: true } });
    expect(states.filter(code => code.status === "ACTIVE")).toHaveLength(2);
    expect(states.filter(code => code.status === "ARCHIVED")).toHaveLength(1);
  } finally {
    if (previousKey === undefined) delete process.env.PROMOTION_CODE_HMAC_KEY; else process.env.PROMOTION_CODE_HMAC_KEY = previousKey;
  }
});

it("does not release a committed or future reservation in an expiry transaction", async () => {
  const committed = await prisma.promotionReservation.create({ data: { publicReference: `${marker}-committed`, campaignVersionId: versionId, checkoutId: "disposable", checkoutReviewVersion: 1, status: "COMMITTED", reservedDiscountAmount: 10, expiresAt: new Date("2020-01-01"), operationId: `${marker}-committed`, requestHash: marker } });
  const future = await prisma.promotionReservation.create({ data: { publicReference: `${marker}-future`, campaignVersionId: versionId, checkoutId: "disposable", checkoutReviewVersion: 1, status: "RESERVED", reservedDiscountAmount: 10, expiresAt: new Date("2099-01-01"), operationId: `${marker}-future`, requestHash: marker } });
  const operationId = `${marker}-release`;
  const result = await prisma.$transaction((tx) => releaseCheckoutPromotions({ reservationIds: [committed.id, future.id], reason: "RESERVATION_EXPIRY", operationId, requestHash: marker, now: new Date() }, tx));
  expect(result.skippedIds.sort()).toEqual([committed.id, future.id].sort());
  expect(await prisma.promotionReservation.count({ where: { id: committed.id, status: "COMMITTED" } })).toBe(1);
  expect(await prisma.promotionReservation.count({ where: { id: future.id, status: "RESERVED" } })).toBe(1);
  expect(await prisma.promotionOperation.findUnique({ where: { operationId } })).toBeNull();
});

it("ends one due version exactly once under competing workers", async () => {
  const results = await Promise.all([expirePromotionCampaigns({ apply: true }), expirePromotionCampaigns({ apply: true })]);
  expect(results.reduce((sum, item) => sum + item.ended, 0)).toBe(1);
  expect((await prisma.promotionCampaignVersion.findUniqueOrThrow({ where: { id: versionId } })).status).toBe("ENDED");
  expect((await prisma.promotionCampaign.findUniqueOrThrow({ where: { id: campaignId } })).status).toBe("ENDED");
  expect(await prisma.promotionStatusHistory.count({ where: { campaignVersionId: versionId, toStatus: "ENDED" } })).toBe(1);
  expect(await prisma.promotionEventIntent.count({ where: { dedupeKey: `promotion-expiry:${versionId}` } })).toBe(1);
});

it("conserves available budget when a reserved discount commits", async () => {
  const budget = await prisma.promotionBudget.create({ data: { campaignVersionId: versionId, approvedAmount: 100, status: "ACTIVE" } });
  await prisma.$transaction((tx) => recordBudgetMovement({ budgetId: budget.id, campaignVersionId: versionId, movementType: "RESERVE", amount: new Decimal(30), operationId: `${marker}-reserve`, requestHash: marker }, tx));
  const result = await prisma.$transaction((tx) => recordBudgetMovement({ budgetId: budget.id, campaignVersionId: versionId, movementType: "COMMIT", amount: new Decimal(30), operationId: `${marker}-commit`, requestHash: marker }, tx));
  expect(result.balanceAfter.toFixed(2)).toBe("70.00");
  const current = await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } });
  expect(current.reservedAmount.toFixed(2)).toBe("0.00");
  expect(current.committedAmount.toFixed(2)).toBe("30.00");
  expect(await prisma.promotionBudgetMovement.count({ where: { budgetId: budget.id } })).toBe(2);
});

it("preserves a frozen budget on release and refuses mismatched or negative movements", async () => {
  const reference = `${marker}-frozen`;
  const campaign = await prisma.promotionCampaign.create({ data: { publicReference: reference, internalCode: reference, ownerType: "PLATFORM", name: "Disposable frozen budget" } });
  const version = await prisma.promotionCampaignVersion.create({ data: { publicReference: `${reference}-version`, campaignId: campaign.id, versionNumber: 1, applicationMethod: "AUTOMATIC", discountScope: "ORDER", discountMechanism: "FIXED_AMOUNT", fundingType: "PLATFORM_FUNDED", startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01") } });
  const budget = await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 100, reservedAmount: 30, status: "FROZEN" } });
  await prisma.$transaction(tx => recordBudgetMovement({ budgetId: budget.id, campaignVersionId: version.id, movementType: "RELEASE", amount: new Decimal(10), operationId: `${reference}-release`, requestHash: marker }, tx));
  expect((await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } })).status).toBe("FROZEN");
  await expect(prisma.$transaction(tx => recordBudgetMovement({ budgetId: budget.id, campaignVersionId: version.id, movementType: "RESERVE", amount: new Decimal(1), operationId: `${reference}-reserve`, requestHash: marker }, tx))).rejects.toThrow("Frozen");
  await expect(prisma.$transaction(tx => recordBudgetMovement({ budgetId: budget.id, campaignVersionId: versionId, movementType: "APPROVED_INCREASE", amount: new Decimal(10), operationId: `${reference}-foreign`, requestHash: marker }, tx))).rejects.toThrow("another campaign");
  await expect(prisma.$transaction(tx => recordBudgetMovement({ budgetId: budget.id, campaignVersionId: version.id, movementType: "APPROVED_INCREASE", amount: new Decimal(-1), operationId: `${reference}-negative`, requestHash: marker }, tx))).rejects.toThrow("positive");
  expect(await prisma.promotionBudgetMovement.count({ where: { budgetId: budget.id } })).toBe(1);
});

it("releases one expired reservation only after its unpaid checkout closes", async () => {
  const cart = await prisma.marketplaceCart.create({ data: { publicReference: `${marker}-cart`, ownerType: "GUEST", guestTokenHash: `${marker}-guest` } });
  const checkout = await prisma.marketplaceCheckout.create({ data: { publicReference: `${marker}-checkout`, cartId: cart.id, status: "RESERVED" } });
  const budget = await prisma.promotionBudget.findUniqueOrThrow({ where: { campaignVersionId: versionId } });
  await prisma.$transaction((tx) => recordBudgetMovement({ budgetId: budget.id, campaignVersionId: versionId, movementType: "RESERVE", amount: new Decimal(10), operationId: `${marker}-reserve-expiry`, requestHash: marker }, tx));
  const reservation = await prisma.promotionReservation.create({ data: { publicReference: `${marker}-due`, campaignVersionId: versionId, checkoutId: checkout.id, checkoutReviewVersion: 1, status: "RESERVED", reservedDiscountAmount: 10, expiresAt: new Date("2020-01-01"), operationId: `${marker}-due`, requestHash: marker } });
  expect((await expirePromotionReservations({ apply: true })).released).toBe(0);
  await prisma.marketplaceCheckout.update({ where: { id: checkout.id }, data: { status: "EXPIRED" } });
  const results = await Promise.all([expirePromotionReservations({ apply: true }), expirePromotionReservations({ apply: true })]);
  expect(results.reduce((sum, item) => sum + item.released, 0)).toBe(1);
  expect((await prisma.promotionReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe("RELEASED");
  expect(await prisma.promotionBudgetMovement.count({ where: { budgetId: budget.id, movementType: "RELEASE" } })).toBe(1);
});

it("opens one reconciliation case across concurrent scans", async () => {
  const cases = await Promise.all(Array.from({ length: 3 }, () => createReconciliationCase("BUDGET_MISMATCH", { campaignVersionId: versionId })));
  expect(new Set(cases.map((item) => item.id)).size).toBe(1);
  expect(await prisma.promotionReconciliationCase.count({ where: { campaignVersionId: versionId, reason: "BUDGET_RESERVATION_MISMATCH", status: "OPEN" } })).toBe(1);
});

it("detects a real reserved-budget mismatch without opening duplicate cases", async () => {
  const budget = await prisma.promotionBudget.findUniqueOrThrow({ where: { campaignVersionId: versionId } });
  const result = await scanPromotionBudgetReconciliation({ limit: 500, apply: true });
  expect(result.mismatches).toBeGreaterThanOrEqual(1);
  expect(await prisma.promotionReconciliationCase.count({ where: { campaignVersionId: budget.campaignVersionId, reason: "BUDGET_RESERVATION_MISMATCH", status: "OPEN" } })).toBe(1);
});

it("runs the invariant-check CLI against actual budget rows", () => {
  const output = execFileSync(process.execPath, ["scripts/verify-promotion-invariants.mjs", "--dry-run", "--limit", "500"], { encoding: "utf8", timeout: 30000 });
  const result = JSON.parse(output.trim().split(/\r?\n/).at(-1)!);
  expect(result.examined).toBeGreaterThanOrEqual(1);
  expect(result.mismatches).toBeGreaterThanOrEqual(1);
  expect(result.cases).toBe(0);
});

it("audits operator monitoring and resolution of an open case", async () => {
  const item = await prisma.promotionReconciliationCase.findFirstOrThrow({ where: { campaignVersionId: versionId, reason: "BUDGET_RESERVATION_MISMATCH", status: "OPEN" } });
  expect((await monitorPromotionReconciliation(item.publicReference, adminId))?.status).toBe("MONITORING");
  expect((await resolvePromotionReconciliation(item.publicReference, { resolutionNotes: "Reviewed the disposable source evidence" }, adminId))?.status).toBe("RESOLVED");
  expect(await prisma.adminActivityLog.count({ where: { actorUserId: adminId, entityType: "PromotionReconciliationCase", entityId: item.id } })).toBe(2);
  await expect(resolvePromotionReconciliation(item.publicReference, { resolutionNotes: "Repeated action should be refused" }, adminId)).rejects.toThrow();
});

it("pauses and ends a campaign exactly once with actor-bound history", async () => {
  const reference = `${marker}-admin-action`;
  const campaign = await prisma.promotionCampaign.create({ data: { publicReference: reference, internalCode: reference, ownerType: "PLATFORM", status: "ACTIVE", name: "Disposable administration" } });
  const version = await prisma.promotionCampaignVersion.create({ data: { publicReference: `${reference}-version`, campaignId: campaign.id, versionNumber: 1, status: "ACTIVE", applicationMethod: "AUTOMATIC", discountScope: "ORDER", discountMechanism: "FIXED_AMOUNT", fundingType: "PLATFORM_FUNDED", approvedByUserId: adminId, approvedAt: new Date(), startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01") } });
  const results = await Promise.allSettled([pauseAdminCampaign(reference, adminId), pauseAdminCampaign(reference, adminId)]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await prisma.promotionCampaignVersion.findUniqueOrThrow({ where: { id: version.id } })).status).toBe("PAUSED");
  await expect(resumeAdminCampaign(reference, adminId)).rejects.toThrow();
  const budget = await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 10, status: "EXHAUSTED" } });
  await expect(resumeAdminCampaign(reference, adminId)).rejects.toThrow();
  await prisma.promotionBudget.update({ where: { id: budget.id }, data: { status: "ACTIVE" } });
  expect((await resumeAdminCampaign(reference, adminId)).status).toBe("ACTIVE");
  await pauseAdminCampaign(reference, adminId);
  expect((await endAdminCampaign(reference, adminId)).status).toBe("ENDED");
  expect((await prisma.promotionCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe("ENDED");
  expect(await prisma.promotionStatusHistory.count({ where: { campaignVersionId: version.id, actorUserId: adminId } })).toBe(4);
  expect(await prisma.adminActivityLog.count({ where: { entityId: campaign.id, actorUserId: adminId } })).toBe(4);
  await expect(endAdminCampaign(reference, adminId)).rejects.toThrow();
});

it("requires separate approval and funded budget before campaign activation", async () => {
  const activator = await prisma.user.create({ data: { email: `${marker}-activator@example.test`, role: "ADMIN", status: "ACTIVE" } });
  const reference = `${marker}-activate`;
  const campaign = await prisma.promotionCampaign.create({ data: { publicReference: reference, internalCode: reference, ownerType: "PLATFORM", status: "APPROVED", name: "Disposable approved campaign" } });
  const version = await prisma.promotionCampaignVersion.create({ data: { publicReference: `${reference}-version`, campaignId: campaign.id, versionNumber: 1, status: "APPROVED", applicationMethod: "AUTOMATIC", discountScope: "ORDER", discountMechanism: "FIXED_AMOUNT", fundingType: "PLATFORM_FUNDED", approvedByUserId: adminId, approvedAt: new Date(), startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01") } });
  await expect(activateAdminCampaign(reference, activator.id)).rejects.toThrow();
  await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 10, status: "ACTIVE" } });
  await expect(activateAdminCampaign(reference, adminId)).rejects.toThrow();
  const results = await Promise.allSettled([activateAdminCampaign(reference, activator.id), activateAdminCampaign(reference, activator.id)]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await prisma.promotionCampaignVersion.findUniqueOrThrow({ where: { id: version.id } })).status).toBe("ACTIVE");
  expect(await prisma.promotionStatusHistory.count({ where: { campaignVersionId: version.id, actorUserId: activator.id, toStatus: "ACTIVE" } })).toBe(1);
});

it("previews real activation candidates and requires an authorized operator session to apply", async () => {
  const actor = await prisma.user.create({ data: { email: `${marker}-batch-operator@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
  const reference = `${marker}-batch-activation`;
  const campaign = await prisma.promotionCampaign.create({ data: { publicReference: reference, internalCode: reference, ownerType: "PLATFORM", status: "APPROVED", name: "Scheduled activation" } });
  const version = await prisma.promotionCampaignVersion.create({ data: { publicReference: `${reference}-version`, campaignId: campaign.id, versionNumber: 1, status: "APPROVED", applicationMethod: "AUTOMATIC", discountScope: "ORDER", discountMechanism: "FIXED_AMOUNT", fixedAmount: 5, fundingType: "PLATFORM_FUNDED", approvedByUserId: adminId, approvedAt: new Date(), startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01") } });
  await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 10, status: "ACTIVE" } });
  const args = ["scripts/activate-approved-promotions.mjs", "--reference", reference];
  const preview = JSON.parse(execFileSync(process.execPath, [...args, "--dry-run"], { encoding: "utf8", timeout: 30000 }).trim());
  expect(preview).toMatchObject({ examined: 1, activated: 0 });
  const denied = spawnSync(process.execPath, [...args, "--apply"], { encoding: "utf8", timeout: 30000, env: { ...process.env, KT_PROMOTION_ADMIN_SESSION: "" } });
  expect(denied.status).not.toBe(0);
  expect((await prisma.promotionCampaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe("APPROVED");
  const token = await createSession(actor.id);
  const result = JSON.parse(execFileSync(process.execPath, [...args, "--apply"], { encoding: "utf8", timeout: 30000, env: { ...process.env, KT_PROMOTION_ADMIN_SESSION: token } }).trim());
  expect(result).toMatchObject({ examined: 1, activated: 1, failed: 0 });
  expect(await prisma.promotionStatusHistory.count({ where: { campaignVersionId: version.id, actorUserId: actor.id, toStatus: "ACTIVE" } })).toBe(1);
}, 30_000);
