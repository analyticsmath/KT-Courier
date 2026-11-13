import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
vi.mock("@/lib/advertising/production-lock", () => ({ assertAdvertisingProductionReady: vi.fn() }));
import { AdvertisingClickService } from "@/lib/advertising/click.service";

const marker = `ad-binding-${randomUUID()}`;
let valid = false;
let versionId = "", serveId = "", placementId = "";
const payload = { serveDecisionId: `${marker}-serve`, campaignVersionId: "", placementCode: marker, sponsoredObjectType: "STORE", sponsoredObjectId: "store", sessionFingerprint: "session", issuedAt: Date.now(), expiresAt: Date.now() + 3600000, destinationReference: "/shop" };
beforeAll(async () => {
  requireDisposableStoreSettlementDatabase(); valid = true;
  const owner = await prisma.user.create({ data: { email: `${marker}@example.test`, role: "STORE", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { ownerUserId: owner.id, name: "Disposable advertiser", slug: marker, status: "ACTIVE" } });
  const account = await prisma.advertisingAccount.create({ data: { publicReference: `${marker}-account`, storeId: store.id } });
  const placement = await prisma.advertisingPlacementDefinition.create({ data: { publicReference: `${marker}-placement`, code: marker, sponsoredObjectType: "STORE", surface: "test", maximumSponsoredItems: 1, minimumOrganicGap: 1, allowedCardType: "STORE", measurementPolicyVersion: "v1", selectionPolicyVersion: "v1", disclosurePolicyVersion: "v1" } }); placementId = placement.id;
  const rate = await prisma.advertisingRateCardVersion.create({ data: { publicReference: `${marker}-rate`, placementDefinitionId: placement.id, versionNumber: 1, costPerValidClick: 1, minimumCampaignFunding: 1 } });
  const campaign = await prisma.advertisingCampaign.create({ data: { publicReference: `${marker}-campaign`, advertisingAccountId: account.id, storeId: store.id, name: "Disposable" } });
  const version = await prisma.advertisingCampaignVersion.create({ data: { publicReference: `${marker}-version`, campaignId: campaign.id, versionNumber: 1, sponsoredObjectType: "STORE", sponsoredStoreId: store.id, placementDefinitionId: placement.id, rateCardVersionId: rate.id, startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01"), dailyBudget: 10, totalBudget: 100, targetingPolicyVersion: "v1", measurementPolicyVersion: "v1", invalidTrafficPolicyVersion: "v1", attributionPolicyVersion: "v1", legalTermsVersion: "v1" } }); versionId = version.id; payload.campaignVersionId = version.id;
  await prisma.advertisingCreativeSnapshot.create({ data: { publicReference: `${marker}-creative`, campaignVersionId: version.id, creativeType: "CANONICAL_STORE_CARD", storeId: store.id, title: "Disposable", imageAssetReference: marker, storeDisplayName: "Disposable", destinationType: "STORE", destinationReference: "/shop" } });
  const decision = await prisma.advertisingServeDecision.create({ data: { publicReference: payload.serveDecisionId, campaignVersionId: version.id, placementDefinitionId: placement.id, sessionFingerprint: "session" } }); serveId = decision.id;
});
afterAll(async () => { if (valid) await prisma.$disconnect(); });
it("stores a non-billable click against the canonical decision and placement", async () => {
  expect(await new AdvertisingClickService().processClick(payload, "session", "bot")).toEqual({ destination: "/shop" });
  const event = await prisma.advertisingMeasurementEvent.findFirstOrThrow({ where: { serveDecisionId: serveId } });
  expect(event).toMatchObject({ campaignVersionId: versionId, placementDefinitionId: placementId, validityStatus: "INVALID" });
  expect(await prisma.advertisingClickCharge.count({ where: { measurementEventId: event.id } })).toBe(0);
  await expect(new AdvertisingClickService().processClick({ ...payload, placementCode: "foreign" }, "session", "bot")).rejects.toThrow();
});
