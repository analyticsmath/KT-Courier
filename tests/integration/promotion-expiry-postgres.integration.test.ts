import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { expirePromotionCampaigns } from "@/lib/promotions/promotion-expiry-batch";
import { releaseCheckoutPromotions } from "@/lib/promotions/promotion-release.service";
import { recordBudgetMovement } from "@/lib/promotions/promotion-budget.service";
import { Decimal } from "@prisma/client/runtime/library";
import { expirePromotionReservations } from "@/lib/promotions/promotion-reservation-expiry-batch";
import { createReconciliationCase } from "@/lib/promotions/promotion-reconciliation.service";
import { scanPromotionBudgetReconciliation } from "@/lib/promotions/promotion-reconciliation-scan";
import { activateAdminCampaign, endAdminCampaign, monitorPromotionReconciliation, pauseAdminCampaign, resolvePromotionReconciliation, resumeAdminCampaign } from "@/lib/promotions/admin-promotions.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

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
