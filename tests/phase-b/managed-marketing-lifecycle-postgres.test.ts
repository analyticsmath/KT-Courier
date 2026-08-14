import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { expectManagedMarketingError } from "./managed-marketing-test-helpers";
import { PermissionEffect, PrivateMediaOwnerType, PrivateMediaPurpose, PrivateMediaStatus, StoreStatus, UserRole, UserStatus } from "@/types/db";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { syncSystemPermissions } from "@/lib/auth/permissions";

const marker = `MML${randomUUID().replaceAll("-", "").toUpperCase()}`;
const service = new ManagedMarketingService();
let operatorId = "";
let deniedOperatorId = "";
let storeUserId = "";
let storeId = "";
let packageReference = "";
let channelReference = "";
let placementReference = "";
let creativeReference = "";
const operator = () => ({ actorUserId: operatorId, actorRole: UserRole.ADMIN });
const deniedOperator = () => ({ actorUserId: deniedOperatorId, actorRole: UserRole.ADMIN });
const storeActor = () => ({ actorUserId: storeUserId, actorRole: UserRole.STORE });
const campaignInput = (operationId: string) => ({ actor: storeActor(), packageReference, selections: [{ channelReference, placementReferences: [placementReference] }], objective: "Lifecycle proof campaign", audience: { segment: "proof" }, message: "Lifecycle proof campaign message.", destinationLink: "https://example.test/lifecycle", startsAt: new Date("2032-02-01T00:00:00.000Z"), endsAt: new Date("2032-02-20T00:00:00.000Z"), operationId });

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await syncSystemPermissions({ actorUserId: `phase-b-${marker}` });
  const [operatorUser, deniedUser, storeUser] = await Promise.all([
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-operator@example.test`, passwordHash: "phase-b-test-only", name: "Marketing operator", role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-denied@example.test`, passwordHash: "phase-b-test-only", name: "Denied marketing operator", role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-store@example.test`, passwordHash: "phase-b-test-only", name: "Lifecycle store owner", role: UserRole.STORE, status: UserStatus.ACTIVE } }),
  ]);
  operatorId = operatorUser.id; deniedOperatorId = deniedUser.id; storeUserId = storeUser.id;
  const deniedPermission = await prisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.MANAGED_MARKETING_REQUESTS_SCHEDULE } });
  await prisma.userPermission.create({ data: { userId: deniedOperatorId, permissionId: deniedPermission.id, effect: PermissionEffect.DENY } });
  const store = await prisma.store.create({ data: { ownerUserId: storeUserId, name: "Lifecycle proof store", slug: `${marker.toLowerCase()}-store`, status: StoreStatus.ACTIVE } });
  storeId = store.id;
  const channel = await service.createChannel({ ...operator(), code: `${marker}_CHANNEL`, displayName: "Lifecycle proof channel" }); channelReference = channel.publicReference;
  const placement = await service.createPlacement({ ...operator(), code: `${marker}_PLACEMENT`, displayName: "Lifecycle proof placement", channelReference, kind: "MANUAL_EXTERNAL", externalPlacementReference: "operator:lifecycle-proof" }); placementReference = placement.publicReference;
  const packageVersion = await service.createPackage({ ...operator(), code: `${marker}_PACKAGE`, name: "Lifecycle proof package", channel: "FACEBOOK", channelReferences: [channelReference], packageTerms: { proof: "lifecycle" }, priceAmount: "500.00", taxRate: "0.1500", effectiveAt: new Date("2031-01-01T00:00:00.000Z") });
  await service.activatePackage(packageVersion.publicReference, operator()); packageReference = packageVersion.publicReference;
  const creative = await prisma.privateMediaObject.create({ data: { publicReference: `PMO-${marker}`, ownerType: PrivateMediaOwnerType.STORE, ownerId: storeId, purpose: PrivateMediaPurpose.OTHER, status: PrivateMediaStatus.READY, storageProvider: "test", storageKey: `lifecycle-proof/${marker}`, originalFileName: "creative.png", declaredMimeType: "image/png", detectedMimeType: "image/png", byteSize: 42, checksum: marker, createdByUserId: storeUserId } });
  creativeReference = creative.publicReference;
});

async function approvedCampaign(operationId: string) {
  const request = await service.createDraft(campaignInput(`${operationId}-DRAFT`));
  await service.attachCreative(storeActor(), request.publicReference, { source: "PRIVATE_MEDIA", mediaReference: creativeReference });
  await service.submitDraft(storeActor(), request.publicReference, `${operationId}-SUBMIT`);
  await service.beginReview(operator(), request.publicReference, `${operationId}-REVIEW`);
  await service.approveRequest(operator(), request.publicReference, `${operationId}-APPROVE`);
  return request;
}

describe("Phase B managed-marketing lifecycle PostgreSQL production-service proof", () => {
  it("keeps lifecycle authority approval-gated, records manual evidence, and completes ended campaigns with processor evidence", async () => {
    const request = await approvedCampaign(`${marker}-LIFECYCLE`);
    await expectManagedMarketingError(service.scheduleRequest(deniedOperator(), request.publicReference, `${marker}-DENIED-SCHEDULE`), "MANAGED_MARKETING_LIFECYCLE_FORBIDDEN");
    expect((await service.scheduleRequest(operator(), request.publicReference, `${marker}-SCHEDULE`)).status).toBe("SCHEDULED");
    expect((await service.scheduleRequest(operator(), request.publicReference, `${marker}-SCHEDULE`)).status).toBe("SCHEDULED");
    expect((await service.runManually(operator(), request.publicReference, { operationId: `${marker}-RUN`, externalReference: "manual-proof-001", actualStartedAt: new Date("2032-02-02T00:00:00.000Z") })).status).toBe("RUNNING");
    expect((await service.pauseRequest(operator(), request.publicReference, `${marker}-PAUSE`)).status).toBe("PAUSED");
    expect((await service.resumeRequest(operator(), request.publicReference, `${marker}-RESUME`)).status).toBe("RUNNING");
    expect((await service.endRequest(operator(), request.publicReference, `${marker}-END`)).status).toBe("ENDED");
    const processor = await service.runLifecycleProcessor({ mode: "APPLY", batchSize: 10, processorOperationId: `${marker}-PROCESSOR` });
    expect(processor.itemsCompleted).toBeGreaterThanOrEqual(1);
    const persisted = await prisma.managedMarketingRequest.findUniqueOrThrow({ where: { id: request.id }, include: { events: true } });
    expect(persisted.status).toBe("COMPLETED");
    expect(persisted.events.some((event) => event.eventType === "PROCESSOR_COMPLETED" && JSON.stringify(event.safeEvidence).includes(`${marker}-PROCESSOR`))).toBe(true);
  });
});
