import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { syncSystemPermissions } from "@/lib/auth/permissions";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { expectManagedMarketingError } from "./managed-marketing-test-helpers";
import { PermissionEffect, UserRole, UserStatus } from "@/types/db";

const marker = `MM${randomUUID().replaceAll("-", "").toUpperCase()}`;
const service = new ManagedMarketingService();
let authorizedActorId = "";
let unauthorizedActorId = "";

const authorizedActor = () => ({ actorUserId: authorizedActorId, actorRole: UserRole.ADMIN });
const unauthorizedActor = () => ({ actorUserId: unauthorizedActorId, actorRole: UserRole.ADMIN });

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await syncSystemPermissions({ actorUserId: `phase-b-${marker}` });
  const [authorized, unauthorized] = await Promise.all([
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-authorized@example.test`, passwordHash: "phase-b-test-only", role: UserRole.ADMIN, status: UserStatus.ACTIVE, name: "Managed marketing authorized administrator" } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-unauthorized@example.test`, passwordHash: "phase-b-test-only", role: UserRole.ADMIN, status: UserStatus.ACTIVE, name: "Managed marketing unauthorized administrator" } }),
  ]);
  authorizedActorId = authorized.id;
  unauthorizedActorId = unauthorized.id;
  const packageCreatePermission = await prisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.MANAGED_MARKETING_PACKAGES_CREATE } });
  const channelManagePermission = await prisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.MANAGED_MARKETING_CHANNELS_MANAGE } });
  await prisma.userPermission.createMany({ data: [
    { userId: unauthorizedActorId, permissionId: packageCreatePermission.id, effect: PermissionEffect.DENY },
    { userId: unauthorizedActorId, permissionId: channelManagePermission.id, effect: PermissionEffect.DENY },
  ] });
});

describe("Phase B managed-marketing package/channel PostgreSQL production-service proof", () => {
  it("preserves effective commercial versions, channel structure, authorization and audit evidence", async () => {
    await expectManagedMarketingError(service.createChannel({ ...unauthorizedActor(), code: `${marker}_DENIED`, displayName: "Unauthorized channel" }), "MANAGED_MARKETING_CONFIGURATION_FORBIDDEN");

    const channel = await service.createChannel({ ...authorizedActor(), code: `${marker}_SOCIAL`, displayName: "Phase B social channel", metadata: { fixture: marker, tier: "primary" } });
    await service.updateChannel(channel.publicReference, { ...authorizedActor(), displayName: "Phase B social channel configured", sortOrder: 10, manualExecutionSupported: true, automatedProviderCapability: "MANUAL_AVAILABLE", providerConfigurationState: "NOT_CONFIGURED", metadata: { fixture: marker, tier: "primary", configured: true } });
    const inactiveChannel = await service.createChannel({ ...authorizedActor(), code: `${marker}_INACTIVE`, displayName: "Phase B inactive channel" });
    await service.setChannelActive(inactiveChannel.publicReference, false, authorizedActor());

    const effectiveA = new Date("2030-01-01T00:00:00.000Z");
    const effectiveB = new Date("2030-02-01T00:00:00.000Z");
    const versionA = await service.createPackage({
      ...authorizedActor(), code: `${marker}_PACKAGE`, name: "Historical commercial package", description: "Version A must remain commercial evidence.", channel: "FACEBOOK", channelReferences: [channel.publicReference], packageTerms: { agreement: "A", deliverables: ["post"] }, durationDays: 30, postCount: 4, videoCount: 1, storyCount: 2, estimatedReachMetadata: { minimum: 1500, maximum: 2500, source: "fixture-A" }, priceAmount: "1299.50", taxRate: "0.1500", currency: "ZAR", effectiveAt: effectiveA,
    });
    await service.activatePackage(versionA.publicReference, authorizedActor());

    const historicalA = await service.selectActivePackageVersion({ reference: versionA.publicReference, channelReference: channel.publicReference, at: new Date("2030-01-15T00:00:00.000Z") });
    expect(historicalA.publicReference).toBe(versionA.publicReference);
    expect(historicalA.priceAmount.toFixed(2)).toBe("1299.50");
    expect(historicalA.estimatedReachMetadata).toEqual({ minimum: 1500, maximum: 2500, source: "fixture-A" });

    // The association is version-scoped; malformed duplicate input within one
    // version is rejected before the per-version unique key acts as backstop.
    await expectManagedMarketingError(service.createPackageVersion(`${marker}_PACKAGE`, { ...authorizedActor(), name: "Duplicate structural association", channel: "FACEBOOK", channelReferences: [channel.publicReference, channel.publicReference], packageTerms: {}, priceAmount: "1.00", taxRate: "0", effectiveAt: effectiveB }), "MANAGED_MARKETING_CHANNEL_NOT_ALLOWED");
    await expectManagedMarketingError(service.createPackage({ ...authorizedActor(), code: `${marker}_INVALID_CHANNEL`, name: "Inactive channel rejected", channel: "FACEBOOK", channelReferences: [inactiveChannel.publicReference], packageTerms: {}, priceAmount: "1.00", taxRate: "0", effectiveAt: effectiveA }), "MANAGED_MARKETING_CHANNEL_NOT_ALLOWED");
    await service.setChannelActive(inactiveChannel.publicReference, true, authorizedActor());

    const versionB = await service.createPackageVersion(`${marker}_PACKAGE`, {
      ...authorizedActor(), name: "Later commercial package", description: "Version B is a later offer.", channel: "FACEBOOK", channelReferences: [channel.publicReference], packageTerms: { agreement: "B", deliverables: ["post", "story"] }, durationDays: 45, postCount: 6, videoCount: 2, storyCount: 3, estimatedReachMetadata: { minimum: 3000, maximum: 5000, source: "fixture-B" }, priceAmount: "1899.75", taxRate: "0.1500", currency: "ZAR", effectiveAt: effectiveB,
    });

    const persistedA = await prisma.managedMarketingPackageVersion.findUniqueOrThrow({ where: { publicReference: versionA.publicReference }, include: { channels: { include: { channelDefinition: true } } } });
    expect(persistedA.priceAmount.toFixed(2)).toBe("1299.50");
    expect(persistedA.taxRate.toFixed(4)).toBe("0.1500");
    expect(persistedA.name).toBe("Historical commercial package");
    expect(persistedA.estimatedReachMetadata).toEqual({ minimum: 1500, maximum: 2500, source: "fixture-A" });
    expect(persistedA.channels).toHaveLength(1);
    expect(persistedA.channels[0].channelDefinitionId).toBe(channel.id);

    await service.activatePackage(versionB.publicReference, authorizedActor());
    const selectedA = await service.selectActivePackageVersion({ code: `${marker}_PACKAGE`, channelReference: channel.publicReference, at: new Date("2030-01-15T00:00:00.000Z") });
    const selectedB = await service.selectActivePackageVersion({ code: `${marker}_PACKAGE`, channelReference: channel.publicReference, at: new Date("2030-02-15T00:00:00.000Z") });
    expect(selectedA.publicReference).toBe(versionA.publicReference);
    expect(selectedB.publicReference).toBe(versionB.publicReference);
    expect(selectedB.priceAmount.toFixed(2)).toBe("1899.75");

    await service.retirePackage(versionA.publicReference, authorizedActor());
    await expectManagedMarketingError(service.selectActivePackageVersion({ reference: versionA.publicReference, channelReference: channel.publicReference, at: new Date("2030-02-15T00:00:00.000Z") }), "MANAGED_MARKETING_PACKAGE_UNAVAILABLE");

    const auditEvidence = await prisma.adminActivityLog.findMany({ where: { actorUserId: authorizedActorId, entityType: { in: ["ManagedMarketingPackageVersion", "ManagedMarketingChannelDefinition"] } }, select: { action: true, entityType: true, entityId: true, metadata: true } });
    expect(auditEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "CREATE", entityType: "ManagedMarketingChannelDefinition", entityId: channel.id }),
      expect.objectContaining({ action: "UPDATE", entityType: "ManagedMarketingChannelDefinition", entityId: channel.id }),
      expect.objectContaining({ action: "CREATE", entityType: "ManagedMarketingPackageVersion", entityId: versionA.id }),
      expect.objectContaining({ action: "STATUS_CHANGE", entityType: "ManagedMarketingPackageVersion", entityId: versionB.id }),
    ]));
    expect(auditEvidence.filter((entry) => entry.entityId === versionA.id && entry.action === "STATUS_CHANGE")).toHaveLength(2);
    expect(auditEvidence.filter((entry) => entry.entityId === inactiveChannel.id && entry.action === "STATUS_CHANGE")).toHaveLength(2);
  });
});
