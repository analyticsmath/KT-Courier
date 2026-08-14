import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { syncSystemPermissions } from "@/lib/auth/permissions";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { expectManagedMarketingError } from "./managed-marketing-test-helpers";
import { PermissionEffect, UserRole, UserStatus } from "@/types/db";

const marker = `MMP${randomUUID().replaceAll("-", "").toUpperCase()}`;
const service = new ManagedMarketingService();
let authorizedActorId = "";
let unauthorizedActorId = "";
const authorizedActor = () => ({ actorUserId: authorizedActorId, actorRole: UserRole.ADMIN });
const unauthorizedActor = () => ({ actorUserId: unauthorizedActorId, actorRole: UserRole.ADMIN });

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await syncSystemPermissions({ actorUserId: `phase-b-${marker}` });
  const [authorized, unauthorized] = await Promise.all([
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-authorized@example.test`, passwordHash: "phase-b-test-only", role: UserRole.ADMIN, status: UserStatus.ACTIVE, name: "Placement authorized administrator" } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-unauthorized@example.test`, passwordHash: "phase-b-test-only", role: UserRole.ADMIN, status: UserStatus.ACTIVE, name: "Placement unauthorized administrator" } }),
  ]);
  authorizedActorId = authorized.id;
  unauthorizedActorId = unauthorized.id;
  const manage = await prisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.MANAGED_MARKETING_PLACEMENTS_MANAGE } });
  await prisma.userPermission.create({ data: { userId: unauthorizedActorId, permissionId: manage.id, effect: PermissionEffect.DENY } });
});

describe("Phase B managed-marketing channel placement PostgreSQL production-service proof", () => {
  it("persists both placement kinds, rejects mismatched targets, and preserves audit evidence", async () => {
    const channel = await service.createChannel({ ...authorizedActor(), code: `${marker}_CHANNEL`, displayName: "Placement proof channel" });
    const platform = await prisma.advertisingPlacementDefinition.create({ data: { publicReference: `ADPL-${marker}`, code: `${marker}_PLATFORM`, sponsoredObjectType: "STORE", surface: "STOREFRONT", status: "ACTIVE", maximumSponsoredItems: 1, minimumOrganicGap: 1, allowedCardType: "CANONICAL_STORE_CARD", measurementPolicyVersion: "proof", selectionPolicyVersion: "proof", disclosurePolicyVersion: "proof" } });

    await expectManagedMarketingError(service.createPlacement({ ...unauthorizedActor(), code: `${marker}_DENIED`, displayName: "Denied", channelReference: channel.publicReference, kind: "MANUAL_EXTERNAL", externalPlacementReference: "external:denied" }), "MANAGED_MARKETING_CONFIGURATION_FORBIDDEN");
    await expectManagedMarketingError(service.createPlacement({ ...authorizedActor(), code: `${marker}_INVALID`, displayName: "Invalid", channelReference: channel.publicReference, kind: "ON_PLATFORM", externalPlacementReference: "external:invalid" }), "MANAGED_MARKETING_PLACEMENT_INVALID");

    const onPlatform = await service.createPlacement({ ...authorizedActor(), code: `${marker}_ON_PLATFORM`, displayName: "Storefront sponsored card", channelReference: channel.publicReference, kind: "ON_PLATFORM", advertisingPlacementReference: platform.publicReference });
    const manual = await service.createPlacement({ ...authorizedActor(), code: `${marker}_EXTERNAL`, displayName: "Manual social post", channelReference: channel.publicReference, kind: "MANUAL_EXTERNAL", externalPlacementReference: "social:operator-run" });
    expect((await service.selectActivePlacement({ reference: onPlatform.publicReference, channelReference: channel.publicReference })).advertisingPlacementDefinitionId).toBe(platform.id);
    expect((await service.selectActivePlacement({ reference: manual.publicReference, channelReference: channel.publicReference })).externalPlacementReference).toBe("social:operator-run");

    await service.setPlacementActive(manual.publicReference, false, authorizedActor());
    await expectManagedMarketingError(service.selectActivePlacement({ reference: manual.publicReference, channelReference: channel.publicReference }), "MANAGED_MARKETING_PLACEMENT_UNAVAILABLE");
    const audit = await prisma.adminActivityLog.findMany({ where: { actorUserId: authorizedActorId, entityType: "ManagedMarketingChannelPlacement" }, select: { action: true, entityId: true } });
    expect(audit).toEqual(expect.arrayContaining([expect.objectContaining({ action: "CREATE", entityId: onPlatform.id }), expect.objectContaining({ action: "STATUS_CHANGE", entityId: manual.id })]));
  });
});
