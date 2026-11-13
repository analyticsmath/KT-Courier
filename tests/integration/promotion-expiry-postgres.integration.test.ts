import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { expirePromotionCampaigns } from "@/lib/promotions/promotion-expiry-batch";
import { releaseCheckoutPromotions } from "@/lib/promotions/promotion-release.service";
import { recordBudgetMovement } from "@/lib/promotions/promotion-budget.service";
import { Decimal } from "@prisma/client/runtime/library";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

const marker = `promotion-expiry-${randomUUID()}`;
let campaignId = "";
let versionId = "";
let validated = false;
beforeAll(async () => {
  requireDisposableStoreSettlementDatabase(); validated = true;
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
