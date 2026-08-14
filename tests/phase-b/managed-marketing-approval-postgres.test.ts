import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { syncSystemPermissions } from "@/lib/auth/permissions";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { expectManagedMarketingError } from "./managed-marketing-test-helpers";
import { PermissionEffect, PrivateMediaOwnerType, PrivateMediaPurpose, PrivateMediaStatus, StoreStatus, UserRole, UserStatus } from "@/types/db";

const marker = `MMAP${randomUUID().replaceAll("-", "").toUpperCase()}`;
const service = new ManagedMarketingService();
let reviewerId = "";
let deniedReviewerId = "";
let storeUserId = "";
let storeId = "";
let packageReference = "";
let channelReference = "";
let placementReference = "";
let creativeReference = "";
const reviewer = () => ({ actorUserId: reviewerId, actorRole: UserRole.ADMIN });
const deniedReviewer = () => ({ actorUserId: deniedReviewerId, actorRole: UserRole.ADMIN });
const storeActor = () => ({ actorUserId: storeUserId, actorRole: UserRole.STORE });
const draft = (operationId: string) => ({ actor: storeActor(), packageReference, selections: [{ channelReference, placementReferences: [placementReference] }], objective: "Reviewable managed campaign", audience: { segment: "proof" }, message: "Reviewable campaign message.", destinationLink: "https://example.test/review", startsAt: new Date("2032-02-01T00:00:00.000Z"), endsAt: new Date("2032-02-20T00:00:00.000Z"), operationId });

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await syncSystemPermissions({ actorUserId: `phase-b-${marker}` });
  const [reviewerUser, deniedUser, storeUser] = await Promise.all([
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-reviewer@example.test`, passwordHash: "phase-b-test-only", name: "Marketing reviewer", role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-denied@example.test`, passwordHash: "phase-b-test-only", name: "Denied reviewer", role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-store@example.test`, passwordHash: "phase-b-test-only", name: "Campaign store owner", role: UserRole.STORE, status: UserStatus.ACTIVE } }),
  ]);
  reviewerId = reviewerUser.id; deniedReviewerId = deniedUser.id; storeUserId = storeUser.id;
  const deniedPermission = await prisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.MANAGED_MARKETING_REQUESTS_REVIEW } });
  await prisma.userPermission.create({ data: { userId: deniedReviewerId, permissionId: deniedPermission.id, effect: PermissionEffect.DENY } });
  const store = await prisma.store.create({ data: { ownerUserId: storeUserId, name: "Approval proof store", slug: `${marker.toLowerCase()}-store`, status: StoreStatus.ACTIVE } });
  storeId = store.id;
  const channel = await service.createChannel({ ...reviewer(), code: `${marker}_CHANNEL`, displayName: "Approval proof channel" }); channelReference = channel.publicReference;
  const placement = await service.createPlacement({ ...reviewer(), code: `${marker}_PLACEMENT`, displayName: "Approval proof placement", channelReference, kind: "MANUAL_EXTERNAL", externalPlacementReference: "operator:approval-proof" }); placementReference = placement.publicReference;
  const packageVersion = await service.createPackage({ ...reviewer(), code: `${marker}_PACKAGE`, name: "Approval proof package", channel: "FACEBOOK", channelReferences: [channelReference], packageTerms: { proof: "approval" }, priceAmount: "500.00", taxRate: "0.1500", effectiveAt: new Date("2031-01-01T00:00:00.000Z") });
  await service.activatePackage(packageVersion.publicReference, reviewer()); packageReference = packageVersion.publicReference;
  const creative = await prisma.privateMediaObject.create({ data: { publicReference: `PMO-${marker}`, ownerType: PrivateMediaOwnerType.STORE, ownerId: storeId, purpose: PrivateMediaPurpose.OTHER, status: PrivateMediaStatus.READY, storageProvider: "test", storageKey: `approval-proof/${marker}`, originalFileName: "creative.png", declaredMimeType: "image/png", detectedMimeType: "image/png", byteSize: 42, checksum: marker, createdByUserId: storeUserId } });
  creativeReference = creative.publicReference;
});

async function submittedRequest(operationId: string) {
  const request = await service.createDraft(draft(`${operationId}-DRAFT`));
  await service.attachCreative(storeActor(), request.publicReference, { source: "PRIVATE_MEDIA", mediaReference: creativeReference });
  await service.submitDraft(storeActor(), request.publicReference, `${operationId}-SUBMIT`);
  return request;
}

describe("Phase B managed-marketing approval PostgreSQL production-service proof", () => {
  it("enforces review authority, gates approval by state, preserves event history, and makes retries idempotent", async () => {
    const request = await submittedRequest(`${marker}-APPROVAL`);
    await expectManagedMarketingError(service.beginReview(deniedReviewer(), request.publicReference, `${marker}-DENIED-REVIEW`), "MANAGED_MARKETING_REVIEW_FORBIDDEN");
    await expectManagedMarketingError(service.approveRequest(storeActor(), request.publicReference, `${marker}-STORE-APPROVE`), "MANAGED_MARKETING_REVIEW_FORBIDDEN");
    await expectManagedMarketingError(service.approveRequest(reviewer(), request.publicReference, `${marker}-EARLY-APPROVE`), "MANAGED_MARKETING_TRANSITION_FORBIDDEN");
    expect((await service.beginReview(reviewer(), request.publicReference, `${marker}-REVIEW`)).status).toBe("UNDER_REVIEW");
    expect((await service.approveRequest(reviewer(), request.publicReference, `${marker}-APPROVE`, "All required creative and placement evidence reviewed.")).status).toBe("APPROVED");
    expect((await service.approveRequest(reviewer(), request.publicReference, `${marker}-APPROVE`)).status).toBe("APPROVED");
    expect((await service.requireApprovedForExecution(request.publicReference)).packageVersion.publicReference).toBe(packageReference);
    const events = await prisma.managedMarketingRequestEvent.findMany({ where: { managedMarketingRequestId: request.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((item) => item.eventType)).toEqual(expect.arrayContaining(["SUBMITTED", "REVIEW_STARTED", "APPROVED"]));
    expect(events.filter((item) => item.eventType === "APPROVED")).toHaveLength(1);
  });

  it("preserves a rejected request and its decision history rather than deleting submitted evidence", async () => {
    const request = await submittedRequest(`${marker}-REJECTION`);
    await service.beginReview(reviewer(), request.publicReference, `${marker}-REJECTION-REVIEW`);
    const rejected = await service.rejectRequest(reviewer(), request.publicReference, `${marker}-REJECT`, "Creative disclosure needs correction.");
    expect(rejected.status).toBe("REJECTED");
    const persisted = await prisma.managedMarketingRequest.findUniqueOrThrow({ where: { id: request.id }, include: { creatives: true, events: true } });
    expect(persisted.reviewReason).toBe("Creative disclosure needs correction.");
    expect(persisted.creatives).toHaveLength(1);
    expect(persisted.events.some((item) => item.eventType === "REJECTED")).toBe(true);
  });
});
