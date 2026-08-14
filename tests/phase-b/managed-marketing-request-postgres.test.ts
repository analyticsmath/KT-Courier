import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { syncSystemPermissions } from "@/lib/auth/permissions";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { expectManagedMarketingError } from "./managed-marketing-test-helpers";
import { PrivateMediaOwnerType, PrivateMediaPurpose, PrivateMediaStatus, StoreStatus, UserRole, UserStatus } from "@/types/db";

const marker = `MMR${randomUUID().replaceAll("-", "").toUpperCase()}`;
const service = new ManagedMarketingService();
let adminId = "";
let storeAUserId = "";
let storeBUserId = "";
let storeAId = "";
let storeBId = "";
let packageReference = "";
let channelReference = "";
let placementReference = "";
let privateAReference = "";
let privateBReference = "";
const adminActor = () => ({ actorUserId: adminId, actorRole: UserRole.ADMIN });
const storeAActor = () => ({ actorUserId: storeAUserId, actorRole: UserRole.STORE });
const storeBActor = () => ({ actorUserId: storeBUserId, actorRole: UserRole.STORE });
const selection = () => [{ channelReference, placementReferences: [placementReference] }];
const draftInput = (operationId: string) => ({ packageReference, selections: selection(), objective: "Increase storefront discovery", audience: { region: "Cape Town", audience: "returning customers" }, message: "A verified promotion message for the selected campaign.", destinationLink: "https://example.test/storefront", instructions: "Use approved brand voice.", startsAt: new Date("2032-01-02T00:00:00.000Z"), endsAt: new Date("2032-01-31T00:00:00.000Z"), operationId });

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await syncSystemPermissions({ actorUserId: `phase-b-${marker}` });
  const [admin, storeAUser, storeBUser] = await Promise.all([
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-admin@example.test`, passwordHash: "phase-b-test-only", name: "Marketing configuration admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-store-a@example.test`, passwordHash: "phase-b-test-only", name: "Store A owner", role: UserRole.STORE, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-store-b@example.test`, passwordHash: "phase-b-test-only", name: "Store B owner", role: UserRole.STORE, status: UserStatus.ACTIVE } }),
  ]);
  adminId = admin.id; storeAUserId = storeAUser.id; storeBUserId = storeBUser.id;
  const [storeA, storeB] = await Promise.all([
    prisma.store.create({ data: { ownerUserId: storeAUserId, name: "Managed marketing Store A", slug: `${marker.toLowerCase()}-a`, status: StoreStatus.ACTIVE } }),
    prisma.store.create({ data: { ownerUserId: storeBUserId, name: "Managed marketing Store B", slug: `${marker.toLowerCase()}-b`, status: StoreStatus.ACTIVE } }),
  ]);
  storeAId = storeA.id; storeBId = storeB.id;
  const channel = await service.createChannel({ ...adminActor(), code: `${marker}_CHANNEL`, displayName: "Proof external channel" });
  channelReference = channel.publicReference;
  const placement = await service.createPlacement({ ...adminActor(), code: `${marker}_PLACEMENT`, displayName: "Proof manual placement", channelReference, kind: "MANUAL_EXTERNAL", externalPlacementReference: "operator:proof" });
  placementReference = placement.publicReference;
  const packageVersion = await service.createPackage({ ...adminActor(), code: `${marker}_PACKAGE`, name: "Proof package version A", channel: "FACEBOOK", channelReferences: [channelReference], packageTerms: { proof: "A" }, priceAmount: "999.00", taxRate: "0.1500", effectiveAt: new Date("2031-01-01T00:00:00.000Z") });
  await service.activatePackage(packageVersion.publicReference, adminActor());
  packageReference = packageVersion.publicReference;
  const [assetA, assetB] = await Promise.all([
    prisma.privateMediaObject.create({ data: { publicReference: `PMO-${marker}-A`, ownerType: PrivateMediaOwnerType.STORE, ownerId: storeAId, purpose: PrivateMediaPurpose.OTHER, status: PrivateMediaStatus.READY, storageProvider: "test", storageKey: `proof/${marker}/a`, originalFileName: "creative-a.png", declaredMimeType: "image/png", detectedMimeType: "image/png", byteSize: 32, checksum: `${marker}-a`, createdByUserId: storeAUserId } }),
    prisma.privateMediaObject.create({ data: { publicReference: `PMO-${marker}-B`, ownerType: PrivateMediaOwnerType.STORE, ownerId: storeBId, purpose: PrivateMediaPurpose.OTHER, status: PrivateMediaStatus.READY, storageProvider: "test", storageKey: `proof/${marker}/b`, originalFileName: "creative-b.png", declaredMimeType: "image/png", detectedMimeType: "image/png", byteSize: 32, checksum: `${marker}-b`, createdByUserId: storeBUserId } }),
  ]);
  privateAReference = assetA.publicReference; privateBReference = assetB.publicReference;
});

describe("Phase B managed-marketing request PostgreSQL production-service proof", () => {
  it("enforces store isolation, commits package version, validates configured selection and locks submitted creative evidence", async () => {
    const draft = await service.createDraft({ ...draftInput(`${marker}-CREATE-A`), actor: storeAActor() });
    expect(draft.storeId).toBe(storeAId);
    expect(draft.packageVersionId).toBeTruthy();
    await expectManagedMarketingError(service.getOwnRequest(storeBActor(), draft.publicReference), "MANAGED_MARKETING_REQUEST_NOT_FOUND");
    await expectManagedMarketingError(service.attachCreative(storeAActor(), draft.publicReference, { source: "PRIVATE_MEDIA", mediaReference: privateBReference }), "MANAGED_MARKETING_CREATIVE_FORBIDDEN");

    const updated = await service.updateDraft(storeAActor(), draft.publicReference, { ...draftInput(`${marker}-UPDATE-A`), message: "Updated still-editable campaign copy." });
    expect(updated.message).toBe("Updated still-editable campaign copy.");
    const creative = await service.attachCreative(storeAActor(), draft.publicReference, { source: "PRIVATE_MEDIA", mediaReference: privateAReference });
    await expectManagedMarketingError(service.attachCreative(storeAActor(), draft.publicReference, { source: "PRIVATE_MEDIA", mediaReference: privateAReference }), "MANAGED_MARKETING_CREATIVE_ALREADY_ATTACHED");

    const submitted = await service.submitDraft(storeAActor(), draft.publicReference, `${marker}-SUBMIT-A`);
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.submittedAt).not.toBeNull();
    const committed = await prisma.managedMarketingRequest.findUniqueOrThrow({ where: { publicReference: draft.publicReference }, include: { packageVersion: true, creatives: true } });
    expect(committed.packageVersion.publicReference).toBe(packageReference);
    expect(committed.creatives.some((item) => item.publicReference === creative.publicReference)).toBe(true);
    await expectManagedMarketingError(service.updateDraft(storeAActor(), draft.publicReference, draftInput(`${marker}-LOCKED`)), "MANAGED_MARKETING_REQUEST_LOCKED");
    await expectManagedMarketingError(service.removeCreative(storeAActor(), draft.publicReference, creative.publicReference), "MANAGED_MARKETING_REQUEST_LOCKED");
  });
});
