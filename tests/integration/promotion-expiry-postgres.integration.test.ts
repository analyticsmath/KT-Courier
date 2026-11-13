import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { expirePromotionCampaigns } from "@/lib/promotions/promotion-expiry-batch";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

const marker = `promotion-expiry-${randomUUID()}`;
let campaignId = "";
let versionId = "";
let validated = false;
beforeAll(() => { requireDisposableStoreSettlementDatabase(); validated = true; });
afterAll(async () => {
  if (!validated) return;
  await prisma.promotionEventIntent.deleteMany({ where: { dedupeKey: `promotion-expiry:${versionId}` } });
  await prisma.promotionStatusHistory.deleteMany({ where: { campaignVersionId: versionId } });
  if (versionId) await prisma.promotionCampaignVersion.delete({ where: { id: versionId } });
  if (campaignId) await prisma.promotionCampaign.delete({ where: { id: campaignId } });
  await prisma.$disconnect();
});

it("ends one due version exactly once under competing workers", async () => {
  const campaign = await prisma.promotionCampaign.create({ data: { publicReference: marker, internalCode: marker, ownerType: "PLATFORM", status: "ACTIVE", name: "Disposable expiry" } });
  campaignId = campaign.id;
  const version = await prisma.promotionCampaignVersion.create({ data: { publicReference: `${marker}-version`, campaignId, versionNumber: 1, status: "ACTIVE", applicationMethod: "AUTOMATIC", discountScope: "ORDER", discountMechanism: "FIXED_AMOUNT", fundingType: "PLATFORM_FUNDED", startsAt: new Date("2020-01-01"), endsAt: new Date("2020-01-02") } });
  versionId = version.id;
  const results = await Promise.all([expirePromotionCampaigns({ apply: true }), expirePromotionCampaigns({ apply: true })]);
  expect(results.reduce((sum, item) => sum + item.ended, 0)).toBe(1);
  expect((await prisma.promotionCampaignVersion.findUniqueOrThrow({ where: { id: versionId } })).status).toBe("ENDED");
  expect((await prisma.promotionCampaign.findUniqueOrThrow({ where: { id: campaignId } })).status).toBe("ENDED");
  expect(await prisma.promotionStatusHistory.count({ where: { campaignVersionId: versionId, toStatus: "ENDED" } })).toBe(1);
  expect(await prisma.promotionEventIntent.count({ where: { dedupeKey: `promotion-expiry:${versionId}` } })).toBe(1);
});
