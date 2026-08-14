import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { syncSystemPermissions } from "@/lib/auth/permissions";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { expectManagedMarketingError } from "./managed-marketing-test-helpers";
import { PrivateMediaOwnerType, PrivateMediaPurpose, PrivateMediaStatus, StoreStatus, UserRole, UserStatus } from "@/types/db";

const marker = `MMB${randomUUID().replaceAll("-", "").toUpperCase()}`;
const service = new ManagedMarketingService();
let adminId = "";
let storeUserId = "";
let storeId = "";
let packageReference = "";
let channelReference = "";
let placementReference = "";
let creativeReference = "";
const admin = () => ({ actorUserId: adminId, actorRole: UserRole.ADMIN });
const store = () => ({ actorUserId: storeUserId, actorRole: UserRole.STORE });
const draft = (operationId: string, executionMode: "MANUAL" | "AUTOMATED_PROVIDER" = "MANUAL") => ({ actor: store(), packageReference, selections: [{ channelReference, placementReferences: [placementReference] }], executionMode, objective: "Boundary proof campaign", audience: { proof: marker }, message: "Managed external boundary proof.", destinationLink: "https://example.test/managed-boundary", startsAt: new Date("2032-04-01T00:00:00.000Z"), endsAt: new Date("2032-04-20T00:00:00.000Z"), operationId });

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await syncSystemPermissions({ actorUserId: `phase-b-${marker}` });
  const [adminUser, storeUser] = await Promise.all([
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-admin@example.test`, passwordHash: "phase-b-test-only", name: "Boundary operator", role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-store@example.test`, passwordHash: "phase-b-test-only", name: "Boundary store", role: UserRole.STORE, status: UserStatus.ACTIVE } }),
  ]);
  adminId = adminUser.id; storeUserId = storeUser.id;
  storeId = (await prisma.store.create({ data: { ownerUserId: storeUserId, name: "Boundary proof store", slug: `${marker.toLowerCase()}-store`, status: StoreStatus.ACTIVE } })).id;
  const channel = await service.createChannel({ ...admin(), code: `${marker}_CHANNEL`, displayName: "Boundary Facebook", automatedProviderCapability: "AUTOMATED_PUBLISHING_SUPPORTED", providerConfigurationState: "NOT_CONFIGURED", metadata: { accessToken: `${marker}-must-not-leak` } }); channelReference = channel.publicReference;
  placementReference = (await service.createPlacement({ ...admin(), code: `${marker}_PLACEMENT`, displayName: "Boundary manual placement", channelReference, kind: "MANUAL_EXTERNAL", externalPlacementReference: "operator:boundary-proof" })).publicReference;
  const packageVersion = await service.createPackage({ ...admin(), code: `${marker}_PACKAGE`, name: "Boundary proof package", channel: "FACEBOOK", channelReferences: [channelReference], packageTerms: { proof: "boundary" }, priceAmount: "100.00", taxRate: "0.1500", effectiveAt: new Date("2031-01-01T00:00:00.000Z") });
  await service.activatePackage(packageVersion.publicReference, admin()); packageReference = packageVersion.publicReference;
  creativeReference = (await prisma.privateMediaObject.create({ data: { publicReference: `PMO-${marker}`, ownerType: PrivateMediaOwnerType.STORE, ownerId: storeId, purpose: PrivateMediaPurpose.OTHER, status: PrivateMediaStatus.READY, storageProvider: "test", storageKey: `boundary/${marker}`, originalFileName: "creative.png", declaredMimeType: "image/png", detectedMimeType: "image/png", byteSize: 42, checksum: marker, createdByUserId: storeUserId } })).publicReference;
});

describe("Phase B managed-marketing external boundary PostgreSQL production-service proof", () => {
  it("keeps manual execution operational, rejects automation without a real publisher, and preserves historical evidence after channel disablement", async () => {
    await expectManagedMarketingError(service.createDraft(draft(`${marker}-AUTO`, "AUTOMATED_PROVIDER")), "MANAGED_MARKETING_PROVIDER_NOT_CONFIGURED");
    const request = await service.createDraft(draft(`${marker}-MANUAL`));
    await service.attachCreative(store(), request.publicReference, { source: "PRIVATE_MEDIA", mediaReference: creativeReference });
    await service.submitDraft(store(), request.publicReference, `${marker}-SUBMIT`);
    await service.beginReview(admin(), request.publicReference, `${marker}-REVIEW`);
    await service.approveRequest(admin(), request.publicReference, `${marker}-APPROVE`);
    await service.setChannelActive(channelReference, false, admin());
    await expectManagedMarketingError(service.scheduleRequest(admin(), request.publicReference, `${marker}-SCHEDULE`), "MANAGED_MARKETING_CHANNEL_DISABLED");
    const persisted = await prisma.managedMarketingRequest.findUniqueOrThrow({ where: { publicReference: request.publicReference }, include: { events: true } });
    expect(persisted.executionMode).toBe("MANUAL");
    expect(persisted.events.some((event) => event.eventType === "DRAFT_CREATED" && JSON.stringify(event.safeEvidence).includes("MANUAL"))).toBe(true);
    const capabilities = await service.listExecutionCapabilities();
    expect(JSON.stringify(capabilities)).not.toContain(`${marker}-must-not-leak`);
  });
});
