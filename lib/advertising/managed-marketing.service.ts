/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { getStoreForUser } from "@/lib/auth/store-context";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { AdvertisingFundingService } from "@/lib/advertising/funding.service";
import { assertPaymentSubjectIntegrity } from "@/lib/payments/payment-subject-policy";
import { runSerializableTransaction } from "@/lib/db/transaction-runner";
import { AdminActionType, UserRole } from "@/types/db";

const ref = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type ConfigurationActor = { actorUserId: string; actorRole: UserRole };
export type ManagedMarketingRequestActor = { actorUserId: string; actorRole: UserRole };
type ChannelSelection = { channelReference: string; placementReferences: string[] };
type ManagedMarketingExecutionMode = "MANUAL" | "AUTOMATED_PROVIDER";

// Provider configuration is deliberately descriptive until a real publishing
// adapter is registered. A configuration record alone must never claim that
// Meta/TikTok/Google publishing succeeded or is executable.
const AUTOMATED_PROVIDER_RUNTIME_AVAILABLE = false;

export class ManagedMarketingRequestError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "ManagedMarketingRequestError"; }
}

export class ManagedMarketingService {
  private async requireConfigurationPermission(actor: ConfigurationActor, permission: string) {
    if (!actor?.actorUserId || (actor.actorRole !== UserRole.ADMIN && actor.actorRole !== UserRole.SUPER_ADMIN) || !(await hasPermission({ userId: actor.actorUserId, role: actor.actorRole, permissionKey: permission }))) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CONFIGURATION_FORBIDDEN", "MARKETING_CONFIGURATION_FORBIDDEN");
  }

  private async audit(actorUserId: string, action: AdminActionType, entityType: string, entityId: string, message: string, metadata: Record<string, unknown>) {
    await recordAdminActivity({ actorUserId, action, entityType, entityId, message, metadata });
  }

  private safeChannelCapability(channel: any, providerConfiguration?: any) {
    const automatedProviderConfigured = channel.automatedProviderCapability === "AUTOMATED_PUBLISHING_SUPPORTED" && channel.providerConfigurationState === "CONFIGURED" && Boolean(providerConfiguration?.automatedProviderEnabled && providerConfiguration?.providerConfigurationReference);
    return {
      id: channel.id,
      publicReference: channel.publicReference,
      code: channel.code,
      displayName: channel.displayName,
      active: channel.active,
      sortOrder: channel.sortOrder,
      manualExecutionSupported: channel.manualExecutionSupported,
      automatedProviderSupported: channel.automatedProviderCapability === "AUTOMATED_PUBLISHING_SUPPORTED",
      automatedProviderConfigured,
      automatedProviderAvailable: automatedProviderConfigured && AUTOMATED_PROVIDER_RUNTIME_AVAILABLE,
      automatedProviderStatus: automatedProviderConfigured && AUTOMATED_PROVIDER_RUNTIME_AVAILABLE ? "AVAILABLE" : automatedProviderConfigured ? "IMPLEMENTATION_UNAVAILABLE" : "NOT_CONFIGURED",
      supportedExecutionModes: channel.active && channel.manualExecutionSupported ? ["MANUAL"] : [],
      placements: channel.placements?.map((p: any) => ({
        id: p.id,
        publicReference: p.publicReference,
        code: p.code,
        displayName: p.displayName,
        kind: p.kind,
        active: p.active,
        sortOrder: p.sortOrder,
      })),
    };
  }

  private safeRequest(request: any) {
    const safeChannel = (channel: any) => channel ? this.safeChannelCapability(channel) : channel;
    const safePlacement = (placement: any) => placement ? { ...placement, channelDefinition: safeChannel(placement.channelDefinition) } : placement;
    return {
      ...request,
      packageVersion: request.packageVersion ? { ...request.packageVersion, channels: request.packageVersion.channels?.map((item: any) => ({ ...item, channelDefinition: safeChannel(item.channelDefinition) })) } : request.packageVersion,
      channels: request.channels?.map((item: any) => ({ ...item, channelDefinition: safeChannel(item.channelDefinition), placements: item.placements?.map((placement: any) => ({ ...placement, placement: safePlacement(placement.placement) })) })),
    };
  }

  private safePlacement(placement: any) { return { ...placement, channelDefinition: this.safeChannelCapability(placement.channelDefinition) }; }
  private safePackage(pack: any) { return { ...pack, channels: pack.channels?.map((item: any) => ({ ...item, channelDefinition: this.safeChannelCapability(item.channelDefinition) })) }; }

  private assertExecutionCapability(mode: ManagedMarketingExecutionMode, channels: any[], providerConfiguration?: any) {
    if (!channels.length || channels.some((channel) => !channel.active)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_DISABLED", "A selected managed marketing channel is disabled.");
    if (mode === "MANUAL") {
      if (channels.some((channel) => !channel.manualExecutionSupported)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_EXECUTION_MODE_NOT_SUPPORTED", "Manual execution is not supported by every selected channel.");
      return;
    }
    if (channels.some((channel) => channel.automatedProviderCapability !== "AUTOMATED_PUBLISHING_SUPPORTED" || channel.providerConfigurationState !== "CONFIGURED") || !providerConfiguration?.automatedProviderEnabled || !providerConfiguration?.providerConfigurationReference) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PROVIDER_NOT_CONFIGURED", "Automated provider publishing requires an explicitly configured provider for every selected channel.");
    if (!AUTOMATED_PROVIDER_RUNTIME_AVAILABLE) throw new ManagedMarketingRequestError("MANAGED_MARKETING_AUTOMATION_NOT_AVAILABLE", "Automated provider publishing is not available until a real provider implementation is registered.");
  }

  private assertChannelProviderConfiguration(input: { automatedProviderCapability: string; providerConfigurationState: string }) {
    if (!["MANUAL_AVAILABLE", "AUTOMATED_PUBLISHING_SUPPORTED"].includes(input.automatedProviderCapability) || !["NOT_CONFIGURED", "CONFIGURED"].includes(input.providerConfigurationState)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_INVALID", "Managed marketing provider capability state is invalid.");
    if (input.providerConfigurationState === "CONFIGURED" && input.automatedProviderCapability !== "AUTOMATED_PUBLISHING_SUPPORTED") throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_INVALID", "Configured provider state requires automated publishing capability.");
  }

  private async getProviderConfiguration(channel: string) {
    if (!["TIKTOK", "FACEBOOK", "INSTAGRAM", "GOOGLE"].includes(channel)) return null;
    return (prisma as any).managedMarketingChannelConfiguration.findUnique({ where: { channel } });
  }

  async createChannel(input: any) {
    await this.requireConfigurationPermission(input, PERMISSIONS.MANAGED_MARKETING_CHANNELS_MANAGE);
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(input.code) || !String(input.displayName ?? "").trim() || !Number.isInteger(Number(input.sortOrder ?? 0)) || Number(input.sortOrder ?? 0) < 0) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_INVALID", "Channel configuration is invalid.");
    const automatedProviderCapability = input.automatedProviderCapability ?? "MANUAL_AVAILABLE";
    const providerConfigurationState = input.providerConfigurationState ?? "NOT_CONFIGURED";
    this.assertChannelProviderConfiguration({ automatedProviderCapability, providerConfigurationState });
    const channel = await (prisma as any).managedMarketingChannelDefinition.create({ data: { publicReference: ref("MMC"), code: input.code, displayName: input.displayName.trim(), sortOrder: input.sortOrder ?? 0, manualExecutionSupported: input.manualExecutionSupported !== false, automatedProviderCapability, providerConfigurationState, metadata: input.metadata ?? null, createdByUserId: input.actorUserId } });
    await this.audit(input.actorUserId, AdminActionType.CREATE, "ManagedMarketingChannelDefinition", channel.id, "Managed marketing channel created.", { channelReference: channel.publicReference, code: channel.code });
    return this.safeChannelCapability(channel);
  }

  async updateChannel(reference: string, input: any) {
    await this.requireConfigurationPermission(input, PERMISSIONS.MANAGED_MARKETING_CHANNELS_MANAGE);
    if (!String(input.displayName ?? "").trim() || !Number.isInteger(Number(input.sortOrder ?? 0)) || Number(input.sortOrder ?? 0) < 0) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_INVALID", "Channel configuration is invalid.");
    const current = await (prisma as any).managedMarketingChannelDefinition.findUnique({ where: { publicReference: reference } });
    if (!current) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_NOT_FOUND", "Managed marketing channel was not found.");
    const automatedProviderCapability = input.automatedProviderCapability ?? current.automatedProviderCapability;
    const providerConfigurationState = input.providerConfigurationState ?? current.providerConfigurationState;
    this.assertChannelProviderConfiguration({ automatedProviderCapability, providerConfigurationState });
    const channel = await (prisma as any).managedMarketingChannelDefinition.update({ where: { publicReference: reference }, data: { displayName: input.displayName.trim(), sortOrder: input.sortOrder, manualExecutionSupported: input.manualExecutionSupported, automatedProviderCapability, providerConfigurationState, metadata: input.metadata, updatedByUserId: input.actorUserId } });
    await this.audit(input.actorUserId, AdminActionType.UPDATE, "ManagedMarketingChannelDefinition", channel.id, "Managed marketing channel configuration changed.", { channelReference: channel.publicReference, code: channel.code });
    return this.safeChannelCapability(channel);
  }

  async setChannelActive(reference: string, active: boolean, actor: ConfigurationActor) {
    await this.requireConfigurationPermission(actor, PERMISSIONS.MANAGED_MARKETING_CHANNELS_MANAGE);
    const channel = await (prisma as any).managedMarketingChannelDefinition.update({ where: { publicReference: reference }, data: { active, updatedByUserId: actor.actorUserId } });
    await this.audit(actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingChannelDefinition", channel.id, `Managed marketing channel ${active ? "enabled" : "disabled"}.`, { channelReference: channel.publicReference, active });
    return this.safeChannelCapability(channel);
  }

  async listChannels() {
    const [channels, providerConfigurations] = await Promise.all([(prisma as any).managedMarketingChannelDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }), (prisma as any).managedMarketingChannelConfiguration.findMany()]);
    const byChannel = new Map(providerConfigurations.map((configuration: any) => [configuration.channel, configuration]));
    return channels.map((channel: any) => this.safeChannelCapability(channel, byChannel.get(channel.code)));
  }
  async listExecutionCapabilities() {
    const [channels, providerConfigurations] = await Promise.all([(prisma as any).managedMarketingChannelDefinition.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }), (prisma as any).managedMarketingChannelConfiguration.findMany()]);
    const byChannel = new Map(providerConfigurations.map((configuration: any) => [configuration.channel, configuration]));
    return channels.map((channel: any) => this.safeChannelCapability(channel, byChannel.get(channel.code)));
  }

  async createPlacement(input: any) {
    await this.requireConfigurationPermission(input, PERMISSIONS.MANAGED_MARKETING_PLACEMENTS_MANAGE);
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(input.code) || !String(input.displayName ?? "").trim() || !String(input.channelReference ?? "").trim() || !Number.isInteger(Number(input.sortOrder ?? 0)) || Number(input.sortOrder ?? 0) < 0 || !["ON_PLATFORM", "MANUAL_EXTERNAL"].includes(input.kind)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PLACEMENT_INVALID", "Placement configuration is invalid.");
    const channel = await (prisma as any).managedMarketingChannelDefinition.findFirst({ where: { publicReference: input.channelReference, active: true } });
    if (!channel) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_NOT_ALLOWED", "MARKETING_CHANNEL_NOT_ALLOWED");
    const target = await this.resolvePlacementTarget(input);
    const placement = await (prisma as any).managedMarketingChannelPlacement.create({ data: { publicReference: ref("MMP"), code: input.code, displayName: input.displayName.trim(), channelDefinitionId: channel.id, kind: input.kind, advertisingPlacementDefinitionId: target.advertisingPlacementDefinitionId, externalPlacementReference: target.externalPlacementReference, sortOrder: input.sortOrder ?? 0, metadata: input.metadata ?? null, createdByUserId: input.actorUserId }, include: { channelDefinition: true, advertisingPlacementDefinition: true } });
    await this.audit(input.actorUserId, AdminActionType.CREATE, "ManagedMarketingChannelPlacement", placement.id, "Managed marketing channel placement created.", { placementReference: placement.publicReference, channelReference: channel.publicReference, kind: placement.kind });
    return this.safePlacement(placement);
  }

  async updatePlacement(reference: string, input: any) {
    await this.requireConfigurationPermission(input, PERMISSIONS.MANAGED_MARKETING_PLACEMENTS_MANAGE);
    if (!String(input.displayName ?? "").trim() || !Number.isInteger(Number(input.sortOrder ?? 0)) || Number(input.sortOrder ?? 0) < 0 || !["ON_PLATFORM", "MANUAL_EXTERNAL"].includes(input.kind)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PLACEMENT_INVALID", "Placement configuration is invalid.");
    const existing = await (prisma as any).managedMarketingChannelPlacement.findUnique({ where: { publicReference: reference }, include: { channelDefinition: true } });
    if (!existing) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PLACEMENT_NOT_FOUND", "Placement was not found.");
    const target = await this.resolvePlacementTarget(input);
    const placement = await (prisma as any).managedMarketingChannelPlacement.update({ where: { id: existing.id }, data: { displayName: input.displayName.trim(), kind: input.kind, advertisingPlacementDefinitionId: target.advertisingPlacementDefinitionId, externalPlacementReference: target.externalPlacementReference, sortOrder: input.sortOrder, metadata: input.metadata ?? null, updatedByUserId: input.actorUserId }, include: { channelDefinition: true, advertisingPlacementDefinition: true } });
    await this.audit(input.actorUserId, AdminActionType.UPDATE, "ManagedMarketingChannelPlacement", placement.id, "Managed marketing channel placement changed.", { placementReference: placement.publicReference, channelReference: placement.channelDefinition.publicReference, kind: placement.kind });
    return this.safePlacement(placement);
  }

  async setPlacementActive(reference: string, active: boolean, actor: ConfigurationActor) {
    await this.requireConfigurationPermission(actor, PERMISSIONS.MANAGED_MARKETING_PLACEMENTS_MANAGE);
    const placement = await (prisma as any).managedMarketingChannelPlacement.update({ where: { publicReference: reference }, data: { active, updatedByUserId: actor.actorUserId }, include: { channelDefinition: true } });
    await this.audit(actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingChannelPlacement", placement.id, `Managed marketing placement ${active ? "enabled" : "disabled"}.`, { placementReference: placement.publicReference, channelReference: placement.channelDefinition.publicReference, active });
    return this.safePlacement(placement);
  }

  async listPlacements(channelReference?: string) { return (await (prisma as any).managedMarketingChannelPlacement.findMany({ where: channelReference ? { channelDefinition: { publicReference: channelReference } } : {}, include: { channelDefinition: true, advertisingPlacementDefinition: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] })).map((placement: any) => this.safePlacement(placement)); }

  async selectActivePlacement(input: { reference: string; channelReference?: string }) {
    const placement = await (prisma as any).managedMarketingChannelPlacement.findFirst({ where: { publicReference: input.reference, active: true, channelDefinition: { active: true, ...(input.channelReference ? { publicReference: input.channelReference } : {}) } }, include: { channelDefinition: true, advertisingPlacementDefinition: true } });
    if (!placement || (placement.kind === "ON_PLATFORM" && placement.advertisingPlacementDefinition?.status !== "ACTIVE")) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PLACEMENT_UNAVAILABLE", "Placement is not available.");
    return placement;
  }

  private async resolvePlacementTarget(input: any) {
    if (input.kind === "ON_PLATFORM") {
      if (!String(input.advertisingPlacementReference ?? "").trim() || input.externalPlacementReference != null) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PLACEMENT_INVALID", "Placement target is invalid.");
      const platformPlacement = await (prisma as any).advertisingPlacementDefinition.findUnique({ where: { publicReference: input.advertisingPlacementReference } });
      if (!platformPlacement || platformPlacement.status !== "ACTIVE") throw new ManagedMarketingRequestError("MANAGED_MARKETING_ON_PLATFORM_PLACEMENT_UNAVAILABLE", "On-platform placement is unavailable.");
      return { advertisingPlacementDefinitionId: platformPlacement.id, externalPlacementReference: null };
    }
    if (!String(input.externalPlacementReference ?? "").trim() || input.advertisingPlacementReference != null) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PLACEMENT_INVALID", "Placement target is invalid.");
    return { advertisingPlacementDefinitionId: null, externalPlacementReference: input.externalPlacementReference.trim() };
  }

  async listPackages(channelReference?: string) {
    return (await (prisma as any).managedMarketingPackageVersion.findMany({
      where: channelReference ? { channels: { some: { channelDefinition: { publicReference: channelReference } } } } : {},
      include: {
        channels: {
          include: {
            channelDefinition: {
              include: {
                placements: {
                  where: { active: true },
                  orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
                },
              },
            },
          },
        },
      },
      orderBy: [{ code: "asc" }, { versionNumber: "desc" }],
    })).map((pack: any) => this.safePackage(pack));
  }

  async getPackageVersion(reference: string) {
    const pack = await (prisma as any).managedMarketingPackageVersion.findUnique({
      where: { publicReference: reference },
      include: {
        channels: {
          include: {
            channelDefinition: {
              include: {
                placements: {
                  where: { active: true },
                  orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
                },
              },
            },
          },
        },
      },
    });
    return pack ? this.safePackage(pack) : null;
  }

  async createPackage(input: any) {
    await this.requireConfigurationPermission(input, PERMISSIONS.MANAGED_MARKETING_PACKAGES_CREATE);
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(input.code) || !String(input.name ?? "").trim() || !Array.isArray(input.channelReferences) || !input.channelReferences.length || !["TIKTOK", "FACEBOOK", "INSTAGRAM", "GOOGLE"].includes(input.channel ?? "FACEBOOK") || !Number.isInteger(Number(input.sortOrder ?? 0)) || Number(input.sortOrder ?? 0) < 0 || !Number.isFinite(new Date(input.effectiveAt).getTime())) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PACKAGE_INVALID", "Package configuration is invalid.");
    if ([input.priceAmount, input.taxRate, input.durationDays ?? 0, input.postCount ?? 0, input.videoCount ?? 0, input.storyCount ?? 0].some((value) => String(value ?? "").trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0) || Number(input.taxRate) > 1) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PACKAGE_INVALID", "Package commercial values are invalid.");
    const channels = await (prisma as any).managedMarketingChannelDefinition.findMany({ where: { publicReference: { in: input.channelReferences }, active: true } });
    if (channels.length !== input.channelReferences.length || channels.length !== new Set(input.channelReferences).size) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_NOT_ALLOWED", "MARKETING_CHANNEL_NOT_ALLOWED");
    const prior = await (prisma as any).managedMarketingPackageVersion.findFirst({ where: { code: input.code }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    const pack = await (prisma as any).managedMarketingPackageVersion.create({ data: { publicReference: ref("MMP"), code: input.code, versionNumber: (prior?.versionNumber ?? 0) + 1, name: input.name.trim(), description: input.description ?? null, sortOrder: input.sortOrder ?? 0, status: "DRAFT", channel: input.channel ?? "FACEBOOK", packageTerms: input.packageTerms ?? {}, durationDays: input.durationDays ?? null, postCount: input.postCount ?? 0, videoCount: input.videoCount ?? 0, storyCount: input.storyCount ?? 0, estimatedReachMetadata: input.estimatedReachMetadata ?? null, priceAmount: String(input.priceAmount), taxRate: String(input.taxRate), currency: input.currency ?? "ZAR", effectiveAt: new Date(input.effectiveAt), createdByUserId: input.actorUserId, channels: { create: channels.map((channel: any) => ({ channelDefinitionId: channel.id })) } }, include: { channels: { include: { channelDefinition: true } } } });
    await this.audit(input.actorUserId, AdminActionType.CREATE, "ManagedMarketingPackageVersion", pack.id, "Managed marketing package version created.", { packageReference: pack.publicReference, code: pack.code, versionNumber: pack.versionNumber });
    return this.safePackage(pack);
  }

  async createPackageVersion(code: string, input: any) { return this.createPackage({ ...input, code }); }
  async activatePackage(reference: string, actor: ConfigurationActor) { await this.requireConfigurationPermission(actor, PERMISSIONS.MANAGED_MARKETING_PACKAGES_ACTIVATE); const pack = await (prisma as any).managedMarketingPackageVersion.update({ where: { publicReference: reference }, data: { status: "ACTIVE", activatedByUserId: actor.actorUserId } }); await this.audit(actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingPackageVersion", pack.id, "Managed marketing package version activated.", { packageReference: pack.publicReference, code: pack.code, versionNumber: pack.versionNumber }); return pack; }
  async retirePackage(reference: string, actor: ConfigurationActor) { await this.requireConfigurationPermission(actor, PERMISSIONS.MANAGED_MARKETING_PACKAGES_RETIRE); const pack = await (prisma as any).managedMarketingPackageVersion.update({ where: { publicReference: reference }, data: { status: "RETIRED", retiredAt: new Date() } }); await this.audit(actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingPackageVersion", pack.id, "Managed marketing package version retired.", { packageReference: pack.publicReference, code: pack.code, versionNumber: pack.versionNumber }); return pack; }
  async selectActivePackageVersion(input: { code?: string; reference?: string; channelReference?: string; at?: Date }) { if (!input.code && !input.reference) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PACKAGE_INVALID", "Package selection is required."); const pack = await (prisma as any).managedMarketingPackageVersion.findFirst({ where: { ...(input.code ? { code: input.code } : {}), ...(input.reference ? { publicReference: input.reference } : {}), status: "ACTIVE", effectiveAt: { lte: input.at ?? new Date() }, ...(input.channelReference ? { channels: { some: { channelDefinition: { publicReference: input.channelReference, active: true } } } } : {}) }, include: { channels: { include: { channelDefinition: true } } }, orderBy: [{ effectiveAt: "desc" }, { versionNumber: "desc" }] }); if (!pack) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PACKAGE_UNAVAILABLE", "Package version is not available."); return pack; }

  private async requireStoreRequestPermission(actor: ManagedMarketingRequestActor, permission: string) {
    if (actor.actorRole !== UserRole.STORE || !(await hasPermission({ userId: actor.actorUserId, role: actor.actorRole, permissionKey: permission }))) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REQUEST_FORBIDDEN", "You are not permitted to manage this marketing request.");
    const store = await getStoreForUser(actor.actorUserId);
    if (!store) throw new ManagedMarketingRequestError("MANAGED_MARKETING_STORE_NOT_FOUND", "No owned store is available for this account.");
    return store;
  }

  private async getOwnedRequest(actor: ManagedMarketingRequestActor, reference: string, permission: string = PERMISSIONS.MANAGED_MARKETING_REQUESTS_READ_OWN) {
    const store = await this.requireStoreRequestPermission(actor, permission);
    const request = await (prisma as any).managedMarketingRequest.findFirst({
      where: { publicReference: reference, storeId: store.id },
      include: {
        packageVersion: { include: { channels: { include: { channelDefinition: true } } } },
        channels: {
          include: {
            channelDefinition: true,
            placements: {
              include: {
                placement: {
                  include: { channelDefinition: true, advertisingPlacementDefinition: true },
                },
              },
            },
          },
        },
        creatives: {
          include: {
            privateMediaObject: {
              select: { publicReference: true, ownerType: true, purpose: true, status: true, detectedMimeType: true, byteSize: true, createdAt: true },
            },
            catalogMediaAsset: {
              select: { publicReference: true, purpose: true, status: true, mimeType: true, byteSize: true, createdAt: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!request) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REQUEST_NOT_FOUND", "Marketing request was not found.");
    return { store, request };
  }

  private assertEditable(request: any) {
    if (request.status !== "DRAFT") throw new ManagedMarketingRequestError("MANAGED_MARKETING_REQUEST_LOCKED", "Submitted or otherwise committed marketing requests cannot be edited.");
  }

  private assertTextAndDates(input: any) {
    if (!String(input.objective ?? "").trim() || String(input.objective).trim().length > 160 || !String(input.message ?? "").trim() || String(input.message).trim().length > 4000 || String(input.instructions ?? "").length > 4000) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REQUEST_INVALID", "Campaign objective, message, or instructions are invalid.");
    const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) throw new ManagedMarketingRequestError("MANAGED_MARKETING_DATES_INVALID", "Requested dates are invalid.");
    try { const url = new URL(String(input.destinationLink)); if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported"); } catch { throw new ManagedMarketingRequestError("MANAGED_MARKETING_DESTINATION_INVALID", "Destination link must be an absolute HTTP(S) URL."); }
  }

  private async validateConfiguration(input: { packageReference: string; selections: ChannelSelection[]; executionMode: ManagedMarketingExecutionMode; at?: Date }) {
    if (!String(input.packageReference ?? "").trim() || !Array.isArray(input.selections) || input.selections.length < 1) throw new ManagedMarketingRequestError("MANAGED_MARKETING_SELECTION_INVALID", "A package and at least one channel selection are required.");
    const channels = new Set(input.selections.map((item) => item.channelReference));
    if (channels.size !== input.selections.length || input.selections.some((item) => !String(item.channelReference ?? "").trim() || !Array.isArray(item.placementReferences) || item.placementReferences.length < 1 || new Set(item.placementReferences).size !== item.placementReferences.length)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_SELECTION_INVALID", "Channel or placement selections are invalid.");
    const pack = await this.selectActivePackageVersion({ reference: input.packageReference, at: input.at });
    const allowed = new Set(pack.channels.map((item: any) => item.channelDefinition.publicReference));
    if ([...channels].some((reference) => !allowed.has(reference))) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CHANNEL_NOT_ALLOWED", "Selected channel is not included in the selected package version.");
    const resolved = await Promise.all(input.selections.map(async (selection) => ({ channelReference: selection.channelReference, placements: await Promise.all(selection.placementReferences.map((placementReference) => this.selectActivePlacement({ reference: placementReference, channelReference: selection.channelReference }))) })));
    this.assertExecutionCapability(input.executionMode, resolved.map((selection: any) => selection.placements[0].channelDefinition), await this.getProviderConfiguration(pack.channel));
    return { pack, resolved };
  }

  private async validateCreativeEntitlement(storeId: string, actorUserId: string, input: { source: "PRIVATE_MEDIA" | "CATALOG_MEDIA"; mediaReference: string }) {
    if (input.source === "PRIVATE_MEDIA") {
      const asset = await (prisma as any).privateMediaObject.findUnique({ where: { publicReference: input.mediaReference } });
      if (!asset || asset.ownerType !== "STORE" || asset.ownerId !== storeId || !["READY", "RETAINED"].includes(asset.status) || asset.deletedAt) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CREATIVE_FORBIDDEN", "Private creative is not an entitled available store asset.");
      if (asset.createdByUserId !== actorUserId) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CREATIVE_FORBIDDEN", "Private creative must have been uploaded by the requesting store actor.");
      return { privateMediaObjectId: asset.id, catalogMediaAssetId: null };
    }
    const asset = await (prisma as any).catalogMediaAsset.findUnique({ where: { publicReference: input.mediaReference } });
    if (!asset || asset.ownerType !== "STORE" || asset.ownerStoreId !== storeId || asset.status !== "READY" || !["PRODUCT_IMAGE", "VARIANT_IMAGE", "BRAND_LOGO"].includes(asset.purpose)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CREATIVE_FORBIDDEN", "Public creative is not an entitled publishable store asset.");
    return { privateMediaObjectId: null, catalogMediaAssetId: asset.id };
  }

  async createDraft(input: any) {
    const store = await this.requireStoreRequestPermission(input.actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_CREATE_OWN);
    this.assertTextAndDates(input);
    const executionMode: ManagedMarketingExecutionMode = input.executionMode ?? "MANUAL";
    if (executionMode !== "MANUAL" && executionMode !== "AUTOMATED_PROVIDER") throw new ManagedMarketingRequestError("MANAGED_MARKETING_EXECUTION_MODE_NOT_SUPPORTED", "Managed marketing execution mode is not supported.");
    const requestHash = input.requestHash ?? digest({ actorUserId: input.actor.actorUserId, packageReference: input.packageReference, selections: input.selections, executionMode, objective: input.objective, audience: input.audience, message: input.message, destinationLink: input.destinationLink, startsAt: input.startsAt, endsAt: input.endsAt, instructions: input.instructions ?? null });
    const replay = await (prisma as any).managedMarketingRequest.findUnique({ where: { operationId: input.operationId } });
    if (replay) { if (replay.requestHash !== requestHash) throw new ManagedMarketingRequestError("MANAGED_MARKETING_IDEMPOTENCY_CONFLICT", "Request operation was already used with different data."); return replay; }
    const configuration = await this.validateConfiguration({ packageReference: input.packageReference, selections: input.selections, executionMode, at: new Date(input.startsAt) });
    const request = await (prisma as any).managedMarketingRequest.create({ data: { publicReference: ref("MMR"), storeId: store.id, requesterUserId: input.actor.actorUserId, packageVersionId: configuration.pack.id, channel: configuration.pack.channel, executionMode, status: "DRAFT", objective: input.objective.trim(), audience: input.audience ?? {}, message: input.message.trim(), destinationLink: input.destinationLink, instructions: input.instructions?.trim() || null, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), priceSnapshot: configuration.pack.priceAmount, taxSnapshot: configuration.pack.taxRate, currency: configuration.pack.currency, operationId: input.operationId, requestHash, channels: { create: configuration.resolved.map((selection: any) => ({ channelDefinitionId: selection.placements[0].channelDefinitionId, placements: { create: selection.placements.map((placement: any) => ({ placementId: placement.id })) } })) }, events: { create: { operationId: `event:${input.operationId}`, eventType: "DRAFT_CREATED", actorUserId: input.actor.actorUserId, safeEvidence: { packageReference: configuration.pack.publicReference, channelReferences: input.selections.map((item: ChannelSelection) => item.channelReference), executionMode } } } }, include: { channels: { include: { channelDefinition: true, placements: { include: { placement: true } } } } } });
    await this.audit(input.actor.actorUserId, AdminActionType.CREATE, "ManagedMarketingRequest", request.id, "Managed marketing request draft created.", { requestReference: request.publicReference, packageReference: configuration.pack.publicReference, storeId: store.id });
    return this.safeRequest(request);
  }

  async listOwnRequests(actor: ManagedMarketingRequestActor) {
    const store = await this.requireStoreRequestPermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_READ_OWN);
    return (await (prisma as any).managedMarketingRequest.findMany({ where: { storeId: store.id }, include: { packageVersion: true, channels: { include: { channelDefinition: true, placements: { include: { placement: true } } } }, creatives: { orderBy: { createdAt: "asc" } }, }, orderBy: { createdAt: "desc" } })).map((request: any) => this.safeRequest(request));
  }

  async getOwnRequest(actor: ManagedMarketingRequestActor, reference: string) { return this.safeRequest((await this.getOwnedRequest(actor, reference)).request); }

  async updateDraft(actor: ManagedMarketingRequestActor, reference: string, input: any) {
    const { request } = await this.getOwnedRequest(actor, reference, PERMISSIONS.MANAGED_MARKETING_REQUESTS_MANAGE_OWN);
    this.assertEditable(request); this.assertTextAndDates(input);
    const executionMode: ManagedMarketingExecutionMode = input.executionMode ?? request.executionMode;
    if (executionMode !== "MANUAL" && executionMode !== "AUTOMATED_PROVIDER") throw new ManagedMarketingRequestError("MANAGED_MARKETING_EXECUTION_MODE_NOT_SUPPORTED", "Managed marketing execution mode is not supported.");
    const configuration = await this.validateConfiguration({ packageReference: input.packageReference, selections: input.selections, executionMode, at: new Date(input.startsAt) });
    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.managedMarketingRequestPlacement.deleteMany({ where: { requestChannel: { managedMarketingRequestId: request.id } } });
      await tx.managedMarketingRequestChannel.deleteMany({ where: { managedMarketingRequestId: request.id } });
      return tx.managedMarketingRequest.update({ where: { id: request.id }, data: { packageVersionId: configuration.pack.id, channel: configuration.pack.channel, executionMode, objective: input.objective.trim(), audience: input.audience ?? {}, message: input.message.trim(), destinationLink: input.destinationLink, instructions: input.instructions?.trim() || null, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), priceSnapshot: configuration.pack.priceAmount, taxSnapshot: configuration.pack.taxRate, currency: configuration.pack.currency, channels: { create: configuration.resolved.map((selection: any) => ({ channelDefinitionId: selection.placements[0].channelDefinitionId, placements: { create: selection.placements.map((placement: any) => ({ placementId: placement.id })) } })) }, events: { create: { operationId: `update:${input.operationId}`, eventType: "DRAFT_UPDATED", actorUserId: actor.actorUserId, safeEvidence: { packageReference: configuration.pack.publicReference, executionMode } } } } });
    });
    await this.audit(actor.actorUserId, AdminActionType.UPDATE, "ManagedMarketingRequest", request.id, "Managed marketing request draft updated.", { requestReference: request.publicReference, packageReference: configuration.pack.publicReference, executionMode });
    return this.safeRequest(updated);
  }

  async attachCreative(actor: ManagedMarketingRequestActor, reference: string, input: { source: "PRIVATE_MEDIA" | "CATALOG_MEDIA"; mediaReference: string; role?: string }) {
    const { store, request } = await this.getOwnedRequest(actor, reference, PERMISSIONS.MANAGED_MARKETING_REQUESTS_MANAGE_OWN);
    this.assertEditable(request);
    const target = await this.validateCreativeEntitlement(store.id, actor.actorUserId, input);
    const duplicate = await (prisma as any).managedMarketingRequestCreative.findFirst({ where: { managedMarketingRequestId: request.id, ...(target.privateMediaObjectId ? { privateMediaObjectId: target.privateMediaObjectId } : { catalogMediaAssetId: target.catalogMediaAssetId }) } });
    if (duplicate) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CREATIVE_ALREADY_ATTACHED", "Creative is already attached to this request.");
    const creative = await (prisma as any).managedMarketingRequestCreative.create({ data: { publicReference: ref("MMRC"), managedMarketingRequestId: request.id, source: input.source, ...target, role: input.role?.trim() || "CREATIVE", createdByUserId: actor.actorUserId } });
    await (prisma as any).managedMarketingRequest.update({ where: { id: request.id }, data: { creativeAssetReference: input.mediaReference } });
    await this.audit(actor.actorUserId, AdminActionType.UPDATE, "ManagedMarketingRequest", request.id, "Managed marketing creative attached.", { requestReference: request.publicReference, creativeReference: creative.publicReference, source: input.source });
    return creative;
  }

  async removeCreative(actor: ManagedMarketingRequestActor, reference: string, creativeReference: string) {
    const { request } = await this.getOwnedRequest(actor, reference, PERMISSIONS.MANAGED_MARKETING_REQUESTS_MANAGE_OWN);
    this.assertEditable(request);
    const creative = await (prisma as any).managedMarketingRequestCreative.findFirst({ where: { publicReference: creativeReference, managedMarketingRequestId: request.id } });
    if (!creative) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CREATIVE_NOT_FOUND", "Creative association was not found.");
    await (prisma as any).managedMarketingRequestCreative.delete({ where: { id: creative.id } });
    await this.audit(actor.actorUserId, AdminActionType.UPDATE, "ManagedMarketingRequest", request.id, "Managed marketing creative removed.", { requestReference: request.publicReference, creativeReference });
    return { removedCreativeReference: creativeReference };
  }

  async submitDraft(actor: ManagedMarketingRequestActor, reference: string, operationId: string) {
    const { request } = await this.getOwnedRequest(actor, reference, PERMISSIONS.MANAGED_MARKETING_REQUESTS_SUBMIT_OWN);
    this.assertEditable(request);
    if (!request.creatives.length) throw new ManagedMarketingRequestError("MANAGED_MARKETING_CREATIVE_REQUIRED", "At least one entitled creative is required before submission.");
    this.assertTextAndDates(request);
    const selections = request.channels.map((channel: any) => ({ channelReference: channel.channelDefinition.publicReference, placementReferences: channel.placements.map((item: any) => item.placement.publicReference) }));
    const configuration = await this.validateConfiguration({ packageReference: request.packageVersion.publicReference, selections, executionMode: request.executionMode, at: request.startsAt });
    const submitted = await prisma.$transaction(async (tx: any) => {
      const event = await tx.managedMarketingRequestEvent.findUnique({ where: { operationId } });
      if (event) return tx.managedMarketingRequest.findUnique({ where: { id: request.id } });
      return tx.managedMarketingRequest.update({ where: { id: request.id }, data: { status: "SUBMITTED", submittedAt: new Date(), events: { create: { operationId, eventType: "SUBMITTED", actorUserId: actor.actorUserId, safeEvidence: { packageReference: configuration.pack.publicReference, packageVersionNumber: configuration.pack.versionNumber, creativeCount: request.creatives.length } } } } });
    });
    await this.audit(actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingRequest", request.id, "Managed marketing request submitted.", { requestReference: request.publicReference, packageReference: configuration.pack.publicReference, packageVersionNumber: configuration.pack.versionNumber });
    return submitted;
  }

  private async requireReviewPermission(actor: ConfigurationActor, permission: string) {
    if (!actor?.actorUserId || (actor.actorRole !== UserRole.ADMIN && actor.actorRole !== UserRole.SUPER_ADMIN) || !(await hasPermission({ userId: actor.actorUserId, role: actor.actorRole, permissionKey: permission }))) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REVIEW_FORBIDDEN", "Managed marketing review access is forbidden.");
  }

  private async getReviewRequest(reference: string) {
    const request = await (prisma as any).managedMarketingRequest.findUnique({
      where: { publicReference: reference },
      include: {
        packageVersion: { include: { channels: { include: { channelDefinition: true } } } },
        channels: {
          include: {
            channelDefinition: true,
            placements: { include: { placement: { include: { channelDefinition: true } } } },
          },
        },
        creatives: {
          include: {
            privateMediaObject: { select: { id: true, publicReference: true, ownerType: true, ownerId: true, status: true, deletedAt: true } },
            catalogMediaAsset: { select: { id: true, publicReference: true, ownerStoreId: true, purpose: true, status: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!request) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REQUEST_NOT_FOUND", "Marketing request was not found.");
    return request;
  }

  private async validateCommittedRequest(request: any) {
    this.assertTextAndDates(request);
    if (!request.packageVersion || !request.channels.length || !request.creatives.length) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REVIEW_PREREQUISITE_INVALID", "Committed request configuration is incomplete.");
    const packageChannels = new Set(request.packageVersion.channels.map((item: any) => item.channelDefinitionId));
    for (const channel of request.channels) {
      if (!packageChannels.has(channel.channelDefinitionId) || !channel.placements.length || channel.placements.some((item: any) => item.placement.channelDefinitionId !== channel.channelDefinitionId)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REVIEW_PREREQUISITE_INVALID", "Committed channel or placement selection is invalid.");
    }
    this.assertExecutionCapability(request.executionMode, request.channels.map((channel: any) => channel.channelDefinition), await this.getProviderConfiguration(request.channel));
    for (const creative of request.creatives) {
      const privateAsset = creative.privateMediaObject;
      const publicAsset = creative.catalogMediaAsset;
      const privateValid = privateAsset && privateAsset.ownerType === "STORE" && privateAsset.ownerId === request.storeId && ["READY", "RETAINED"].includes(privateAsset.status) && !privateAsset.deletedAt;
      const publicValid = publicAsset && publicAsset.ownerStoreId === request.storeId && publicAsset.status === "READY" && ["PRODUCT_IMAGE", "VARIANT_IMAGE", "BRAND_LOGO"].includes(publicAsset.purpose);
      if (!privateValid && !publicValid) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REVIEW_PREREQUISITE_INVALID", "Committed creative evidence is unavailable or no longer entitled to the requesting store.");
    }
  }

  private async applyReviewTransition(input: { reference: string; actor: ConfigurationActor; permission: string; operationId: string; eventType: "REVIEW_STARTED" | "APPROVED" | "REJECTED"; expectedStatus: "SUBMITTED" | "UNDER_REVIEW"; nextStatus: "UNDER_REVIEW" | "APPROVED" | "REJECTED"; reason?: string | null }) {
    await this.requireReviewPermission(input.actor, input.permission);
    const current = await this.getReviewRequest(input.reference);
    if (input.eventType === "APPROVED") await this.validateCommittedRequest(current);
    if (input.eventType === "REJECTED" && !String(input.reason ?? "").trim()) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REJECTION_REASON_REQUIRED", "A rejection reason is required.");
    const result = await prisma.$transaction(async (tx: any) => {
      const request = await tx.managedMarketingRequest.findUnique({ where: { id: current.id } });
      const existingEvent = await tx.managedMarketingRequestEvent.findUnique({ where: { operationId: input.operationId } });
      if (existingEvent) {
        if (existingEvent.managedMarketingRequestId !== current.id || existingEvent.eventType !== input.eventType) throw new ManagedMarketingRequestError("MANAGED_MARKETING_IDEMPOTENCY_CONFLICT", "Review operation identifier was already used for a different transition.");
        return { request, applied: false };
      }
      if (!request || request.status !== input.expectedStatus) throw new ManagedMarketingRequestError("MANAGED_MARKETING_TRANSITION_FORBIDDEN", "Marketing request is not in the required workflow state.");
      const updated = await tx.managedMarketingRequest.update({ where: { id: current.id }, data: { status: input.nextStatus, reviewedByUserId: input.actor.actorUserId, reviewReason: input.reason?.trim() || null, events: { create: { operationId: input.operationId, eventType: input.eventType, actorUserId: input.actor.actorUserId, safeEvidence: { fromStatus: input.expectedStatus, toStatus: input.nextStatus, reasonProvided: Boolean(input.reason?.trim()) } } } } });
      return { request: updated, applied: true };
    });
    if (result.applied) await this.audit(input.actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingRequest", current.id, `Managed marketing request ${input.eventType.toLowerCase().replaceAll("_", " ")}.`, { requestReference: current.publicReference, fromStatus: input.expectedStatus, toStatus: input.nextStatus, reasonProvided: Boolean(input.reason?.trim()) });
    return result.request;
  }

  async listRequestsForReview(actor: ConfigurationActor, input: { status?: string } = {}) {
    await this.requireReviewPermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_REVIEW);
    return (await (prisma as any).managedMarketingRequest.findMany({ where: input.status ? { status: input.status } : {}, include: { packageVersion: true, channels: { include: { channelDefinition: true, placements: { include: { placement: true } } } }, creatives: { orderBy: { createdAt: "asc" } } }, orderBy: { submittedAt: "asc" } })).map((request: any) => this.safeRequest(request));
  }

  async getRequestForReview(actor: ConfigurationActor, reference: string) { await this.requireReviewPermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_REVIEW); return this.safeRequest(await this.getReviewRequest(reference)); }
  async beginReview(actor: ConfigurationActor, reference: string, operationId: string, note?: string | null) { return this.applyReviewTransition({ actor, reference, operationId, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_REVIEW, eventType: "REVIEW_STARTED", expectedStatus: "SUBMITTED", nextStatus: "UNDER_REVIEW", reason: note }); }
  async approveRequest(actor: ConfigurationActor, reference: string, operationId: string, note?: string | null) { return this.applyReviewTransition({ actor, reference, operationId, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_APPROVE, eventType: "APPROVED", expectedStatus: "UNDER_REVIEW", nextStatus: "APPROVED", reason: note }); }
  async rejectRequest(actor: ConfigurationActor, reference: string, operationId: string, reason: string) { return this.applyReviewTransition({ actor, reference, operationId, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_REJECT, eventType: "REJECTED", expectedStatus: "UNDER_REVIEW", nextStatus: "REJECTED", reason }); }

  private async requireLifecyclePermission(actor: ConfigurationActor, permission: string) {
    if (!actor?.actorUserId || (actor.actorRole !== UserRole.ADMIN && actor.actorRole !== UserRole.SUPER_ADMIN) || !(await hasPermission({ userId: actor.actorUserId, role: actor.actorRole, permissionKey: permission }))) throw new ManagedMarketingRequestError("MANAGED_MARKETING_LIFECYCLE_FORBIDDEN", "Managed marketing lifecycle access is forbidden.");
  }

  private assertLifecycleWindow(request: any, now: Date) {
    this.assertTextAndDates(request);
    if (new Date(request.endsAt) <= now) throw new ManagedMarketingRequestError("MANAGED_MARKETING_EXECUTION_WINDOW_ENDED", "The campaign execution window has already ended.");
  }

  private async applyLifecycleTransition(input: { reference: string; actor?: ConfigurationActor; permission?: string; operationId: string; eventType: string; expectedStatuses: string[]; nextStatus: string; updates?: Record<string, unknown>; safeEvidence?: Record<string, unknown>; validateCommitted?: boolean }) {
    if (input.actor && input.permission) await this.requireLifecyclePermission(input.actor, input.permission);
    const current = await this.getReviewRequest(input.reference);
    if (input.validateCommitted) await this.validateCommittedRequest(current);
    const result = await prisma.$transaction(async (tx: any) => {
      const event = await tx.managedMarketingRequestEvent.findUnique({ where: { operationId: input.operationId } });
      if (event) {
        if (event.managedMarketingRequestId !== current.id || event.eventType !== input.eventType) throw new ManagedMarketingRequestError("MANAGED_MARKETING_IDEMPOTENCY_CONFLICT", "Lifecycle operation identifier was already used for a different transition.");
        return { request: await tx.managedMarketingRequest.findUnique({ where: { id: current.id } }), applied: false };
      }
      const transition = await tx.managedMarketingRequest.updateMany({ where: { id: current.id, status: { in: input.expectedStatuses } }, data: { status: input.nextStatus, ...(input.updates ?? {}) } });
      if (transition.count !== 1) throw new ManagedMarketingRequestError("MANAGED_MARKETING_TRANSITION_FORBIDDEN", "Marketing request is not in a state that permits this lifecycle transition.");
      await tx.managedMarketingRequestEvent.create({ data: { managedMarketingRequestId: current.id, operationId: input.operationId, eventType: input.eventType, actorUserId: input.actor?.actorUserId ?? null, safeEvidence: { fromStatuses: input.expectedStatuses, toStatus: input.nextStatus, ...(input.safeEvidence ?? {}) } } });
      return { request: await tx.managedMarketingRequest.findUnique({ where: { id: current.id } }), applied: true };
    });
    if (result.applied && input.actor) await this.audit(input.actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingRequest", current.id, `Managed marketing request ${input.eventType.toLowerCase().replaceAll("_", " ")}.`, { requestReference: current.publicReference, fromStatuses: input.expectedStatuses, toStatus: input.nextStatus });
    return result;
  }

  async scheduleRequest(actor: ConfigurationActor, reference: string, operationId: string, note?: string | null) {
    await this.requireLifecyclePermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_SCHEDULE);
    const existingEvent = await (prisma as any).managedMarketingRequestEvent.findUnique({ where: { operationId } });
    if (existingEvent) {
      return (await this.applyLifecycleTransition({ reference, actor, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_SCHEDULE, operationId, eventType: "SCHEDULED", expectedStatuses: ["APPROVED", "SCHEDULED"], nextStatus: "SCHEDULED" })).request;
    }
    const current = await this.requireApprovedForExecution(reference);
    await this.validateCommittedRequest(current);
    this.assertLifecycleWindow(current, new Date());
    return (await this.applyLifecycleTransition({ reference, actor, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_SCHEDULE, operationId, eventType: "SCHEDULED", expectedStatuses: ["APPROVED"], nextStatus: "SCHEDULED", updates: { scheduledAt: new Date() }, safeEvidence: { note: note?.trim() || null, campaignStartsAt: new Date(current.startsAt).toISOString(), campaignEndsAt: new Date(current.endsAt).toISOString() } })).request;
  }

  async runManually(actor: ConfigurationActor, reference: string, input: { operationId: string; externalReference: string; actualStartedAt?: Date; note?: string | null }) {
    await this.requireLifecyclePermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_EXECUTE);
    const current = await this.getReviewRequest(reference);
    if (current.executionMode !== "MANUAL") throw new ManagedMarketingRequestError("MANAGED_MARKETING_PROVIDER_UNAVAILABLE", "Automated provider publishing is not configured; it cannot be recorded as manual execution.");
    await this.validateCommittedRequest(current);
    this.assertLifecycleWindow(current, new Date());
    const actualStartedAt = input.actualStartedAt ? new Date(input.actualStartedAt) : new Date();
    if (!String(input.externalReference ?? "").trim() || !Number.isFinite(actualStartedAt.getTime()) || actualStartedAt < new Date(current.startsAt) || actualStartedAt >= new Date(current.endsAt)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_EXECUTION_EVIDENCE_INVALID", "Manual execution evidence must include a reference and a start time inside the campaign window.");
    return (await this.applyLifecycleTransition({ reference, actor, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_EXECUTE, operationId: input.operationId, eventType: "MANUAL_RUN_RECORDED", expectedStatuses: ["SCHEDULED"], nextStatus: "RUNNING", updates: { runningAt: actualStartedAt }, safeEvidence: { executionMode: "MANUAL", externalReference: input.externalReference.trim(), actualStartedAt: actualStartedAt.toISOString(), note: input.note?.trim() || null }, validateCommitted: true })).request;
  }

  async pauseRequest(actor: ConfigurationActor, reference: string, operationId: string, note?: string | null) {
    await this.requireLifecyclePermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_PAUSE);
    return (await this.applyLifecycleTransition({ reference, actor, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_PAUSE, operationId, eventType: "PAUSED", expectedStatuses: ["RUNNING"], nextStatus: "PAUSED", updates: { pausedAt: new Date() }, safeEvidence: { note: note?.trim() || null } })).request;
  }

  async resumeRequest(actor: ConfigurationActor, reference: string, operationId: string, note?: string | null) {
    await this.requireLifecyclePermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_PAUSE);
    const current = await this.getReviewRequest(reference);
    this.assertLifecycleWindow(current, new Date());
    return (await this.applyLifecycleTransition({ reference, actor, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_PAUSE, operationId, eventType: "RESUMED", expectedStatuses: ["PAUSED"], nextStatus: "RUNNING", safeEvidence: { note: note?.trim() || null } })).request;
  }

  async endRequest(actor: ConfigurationActor, reference: string, operationId: string, note?: string | null) {
    await this.requireLifecyclePermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_END);
    return (await this.applyLifecycleTransition({ reference, actor, permission: PERMISSIONS.MANAGED_MARKETING_REQUESTS_END, operationId, eventType: "ENDED", expectedStatuses: ["SCHEDULED", "RUNNING", "PAUSED"], nextStatus: "ENDED", updates: { endedAt: new Date() }, safeEvidence: { source: "OPERATOR", note: note?.trim() || null } })).request;
  }

  async runLifecycleProcessor(input: { mode: "DRY_RUN" | "APPLY"; batchSize: number; processorOperationId: string }) {
    const now = new Date();
    const candidates = await (prisma as any).managedMarketingRequest.findMany({ where: { OR: [{ status: "ENDED" }, { status: { in: ["SCHEDULED", "RUNNING", "PAUSED"] }, endsAt: { lte: now } }] }, select: { id: true, publicReference: true, status: true, endsAt: true }, orderBy: { endsAt: "asc" }, take: input.batchSize });
    if (input.mode === "DRY_RUN") return { itemsExamined: candidates.length, itemsClaimed: 0, itemsCompleted: 0, itemsSkipped: candidates.length, itemsReconciled: 0, safeSummary: `DRY_RUN identified ${candidates.length} due managed marketing lifecycle records.` };
    let itemsCompleted = 0;
    let itemsSkipped = 0;
    for (const candidate of candidates) {
      try {
        if (candidate.status !== "ENDED") {
          const ended = await this.applyLifecycleTransition({ reference: candidate.publicReference, operationId: `${input.processorOperationId}:ENDED:${candidate.id}`, eventType: "PROCESSOR_ENDED", expectedStatuses: [candidate.status], nextStatus: "ENDED", updates: { endedAt: now }, safeEvidence: { processorName: "process-managed-marketing-lifecycle", processorOperationId: input.processorOperationId, executionWindowEndedAt: new Date(candidate.endsAt).toISOString() } });
          if (!ended.applied && ended.request?.status !== "ENDED") { itemsSkipped++; continue; }
        }
        const completed = await this.applyLifecycleTransition({ reference: candidate.publicReference, operationId: `${input.processorOperationId}:COMPLETED:${candidate.id}`, eventType: "PROCESSOR_COMPLETED", expectedStatuses: ["ENDED"], nextStatus: "COMPLETED", updates: { completedAt: now }, safeEvidence: { processorName: "process-managed-marketing-lifecycle", processorOperationId: input.processorOperationId } });
        if (completed.applied) itemsCompleted++; else itemsSkipped++;
      } catch (error) {
        if (error instanceof ManagedMarketingRequestError && error.code === "MANAGED_MARKETING_TRANSITION_FORBIDDEN") itemsSkipped++; else throw error;
      }
    }
    return { itemsExamined: candidates.length, itemsClaimed: candidates.length, itemsCompleted, itemsSkipped, itemsReconciled: 0, safeSummary: `Completed ${itemsCompleted} managed marketing lifecycle records with processor evidence.` };
  }

  private committedCommercialAmounts(request: any) {
    const revenue = new Prisma.Decimal(request.priceSnapshot);
    const tax = revenue.mul(new Prisma.Decimal(request.taxSnapshot)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return { revenue, tax, gross: revenue.add(tax) };
  }

  async preparePayment(actor: ManagedMarketingRequestActor, reference: string, operationId: string) {
    const { request } = await this.getOwnedRequest(actor, reference, PERMISSIONS.MANAGED_MARKETING_REQUESTS_PAY_OWN);
    if (!['APPROVED', 'SCHEDULED', 'RUNNING', 'PAUSED', 'ENDED', 'COMPLETED'].includes(request.status)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PAYMENT_NOT_ELIGIBLE", "Only an approved managed marketing request may be prepared for payment.");
    const amounts = this.committedCommercialAmounts(request);
    assertPaymentSubjectIntegrity({ subjectType: "MANAGED_MARKETING_REQUEST", userId: actor.actorUserId, orderId: null, marketplaceCheckoutId: null, managedMarketingRequestId: request.id, managedMarketingRequesterUserId: request.requesterUserId });
    const requestHash = digest({ requestId: request.id, packageVersionId: request.packageVersionId, gross: amounts.gross.toFixed(2), currency: request.currency });
    const payment = await prisma.$transaction(async (tx: any) => {
      const replay = await tx.payment.findUnique({ where: { creationIdempotencyKey: operationId } });
      if (replay) {
        if (replay.managedMarketingRequestId !== request.id || replay.creationRequestHash !== requestHash) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PAYMENT_CONFLICT", "Payment operation identifier is already associated with different commercial evidence.");
        return replay;
      }
      const existing = await tx.payment.findUnique({ where: { managedMarketingRequestId: request.id } });
      if (existing) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PAYMENT_CONFLICT", "This managed marketing request already has canonical payment evidence.");
      const created = await tx.payment.create({ data: { publicReference: ref("PAY"), user: actor.actorUserId ? { connect: { id: actor.actorUserId } } : undefined, subjectType: "MANAGED_MARKETING_REQUEST", managedMarketingRequest: { connect: { id: request.id } }, purpose: "AD_PURCHASE", provider: "PAYFAST", status: "CREATED", amount: amounts.gross, currency: request.currency, creationIdempotencyKey: operationId, creationRequestHash: requestHash, metadata: { managedMarketingRequestReference: request.publicReference, packageVersionReference: request.packageVersion.publicReference, baseAmount: amounts.revenue.toFixed(2), taxAmount: amounts.tax.toFixed(2), policyVersion: "managed-marketing-commercial-v1" } } });
      await tx.paymentStatusHistory.create({ data: { paymentId: created.id, fromStatus: null, toStatus: "CREATED", reasonCode: "MANAGED_MARKETING_PAYMENT_PREPARED", actorType: "PAYER", actorId: actor.actorUserId, metadata: { managedMarketingRequestReference: request.publicReference, packageVersionReference: request.packageVersion.publicReference } } });
      await tx.managedMarketingRequestEvent.create({ data: { managedMarketingRequestId: request.id, operationId: `payment-prepared:${operationId}`, eventType: "PAYMENT_PREPARED", actorUserId: actor.actorUserId, safeEvidence: { paymentReference: created.publicReference, grossAmount: amounts.gross.toFixed(2), currency: request.currency } } });
      return created;
    });
    await this.audit(actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingRequest", request.id, "Managed marketing payment prepared.", { requestReference: request.publicReference, paymentReference: payment.publicReference, grossAmount: amounts.gross.toFixed(2), currency: request.currency });
    return { publicReference: payment.publicReference, status: payment.status, amount: payment.amount.toFixed(2), currency: payment.currency };
  }

  async recordPerformance(actor: ConfigurationActor, reference: string, input: { operationId: string; periodStartsAt: Date; periodEndsAt: Date; impressions: number; clicks: number; conversions: number; externalReference: string; note?: string | null }) {
    await this.requireLifecyclePermission(actor, PERMISSIONS.MANAGED_MARKETING_REQUESTS_RECORD_PERFORMANCE);
    const request = await this.getReviewRequest(reference);
    if (!['RUNNING', 'PAUSED', 'ENDED', 'COMPLETED'].includes(request.status) || input.periodStartsAt >= input.periodEndsAt || input.periodStartsAt < new Date(request.startsAt) || input.periodEndsAt > new Date(request.endsAt) || [input.impressions, input.clicks, input.conversions].some((value) => !Number.isSafeInteger(value) || value < 0) || input.clicks > input.impressions || input.conversions > input.clicks || !input.externalReference.trim()) throw new ManagedMarketingRequestError("MANAGED_MARKETING_PERFORMANCE_INVALID", "Performance evidence is invalid for this managed marketing campaign.");
    const record = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.managedMarketingPerformanceRecord.findUnique({ where: { operationId: input.operationId } });
      if (existing) {
        if (existing.managedMarketingRequestId !== request.id) throw new ManagedMarketingRequestError("MANAGED_MARKETING_IDEMPOTENCY_CONFLICT", "Performance operation identifier belongs to another campaign.");
        return existing;
      }
      const created = await tx.managedMarketingPerformanceRecord.create({ data: { publicReference: ref("MMPF"), managedMarketingRequestId: request.id, operationId: input.operationId, periodStartsAt: input.periodStartsAt, periodEndsAt: input.periodEndsAt, impressions: input.impressions, clicks: input.clicks, conversions: input.conversions, externalReference: input.externalReference.trim(), safeEvidence: { note: input.note?.trim() || null }, recordedByUserId: actor.actorUserId } });
      await tx.managedMarketingRequestEvent.create({ data: { managedMarketingRequestId: request.id, operationId: `performance:${input.operationId}`, eventType: "PERFORMANCE_RECORDED", actorUserId: actor.actorUserId, safeEvidence: { performanceReference: created.publicReference, externalReference: created.externalReference, impressions: created.impressions, clicks: created.clicks, conversions: created.conversions } } });
      return created;
    });
    await this.audit(actor.actorUserId, AdminActionType.STATUS_CHANGE, "ManagedMarketingRequest", request.id, "Managed marketing performance recorded.", { requestReference: request.publicReference, performanceReference: record.publicReference });
    return record;
  }

  private reportRow(request: any) {
    const performance = request.performanceRecords.reduce((total: any, record: any) => ({ impressions: total.impressions + record.impressions, clicks: total.clicks + record.clicks, conversions: total.conversions + record.conversions }), { impressions: 0, clicks: 0, conversions: 0 });
    const amounts = this.committedCommercialAmounts(request);
    const evidence = request.billingEvidence;
    return { advertiser: { storeId: request.storeId, requesterUserId: request.requesterUserId }, campaign: { reference: request.publicReference, status: request.status, startsAt: request.startsAt, endsAt: request.endsAt }, package: { reference: request.packageVersion.publicReference, code: request.packageVersion.code, versionNumber: request.packageVersion.versionNumber }, commercial: { committedBaseAmount: amounts.revenue.toFixed(2), committedTaxAmount: amounts.tax.toFixed(2), committedGrossAmount: amounts.gross.toFixed(2), currency: request.currency, paymentReference: evidence?.payment.publicReference ?? null, receiptLedgerJournalReference: evidence?.receiptLedgerJournal.reference ?? null, revenueLedgerJournalReference: evidence?.revenueLedgerJournal.reference ?? null, recognizedRevenueAmount: evidence?.revenueAmount.toFixed(2) ?? "0.00", recognizedTaxAmount: evidence?.taxAmount.toFixed(2) ?? "0.00", reconciliationStatus: evidence ? "RECONCILED" : "PENDING_BILLING_EVIDENCE" }, performance };
  }

  private reportInclude = { packageVersion: { select: { publicReference: true, code: true, versionNumber: true } }, billingEvidence: { include: { payment: { select: { publicReference: true } }, receiptLedgerJournal: { select: { reference: true } }, revenueLedgerJournal: { select: { reference: true } } } }, performanceRecords: { orderBy: { periodStartsAt: "asc" as const } } };

  async getOwnReport(actor: ManagedMarketingRequestActor, reference: string) {
    const { store } = await this.getOwnedRequest(actor, reference, PERMISSIONS.MANAGED_MARKETING_REQUESTS_READ_OWN);
    const request = await (prisma as any).managedMarketingRequest.findFirst({ where: { publicReference: reference, storeId: store.id }, include: this.reportInclude });
    if (!request) throw new ManagedMarketingRequestError("MANAGED_MARKETING_REQUEST_NOT_FOUND", "Marketing request was not found.");
    return this.reportRow(request);
  }

  async listRevenueReports(actor: ConfigurationActor, input: { from?: Date; to?: Date; storeId?: string } = {}) {
    await this.requireLifecyclePermission(actor, PERMISSIONS.MANAGED_MARKETING_REPORTS_READ);
    const requests = await (prisma as any).managedMarketingRequest.findMany({ where: { ...(input.storeId ? { storeId: input.storeId } : {}), ...(input.from || input.to ? { startsAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}) }, include: this.reportInclude, orderBy: { startsAt: "desc" } });
    return requests.map((request: any) => this.reportRow(request));
  }

  async recognizeVerifiedPayment(paymentId: string) {
    const platform = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
    const taxPayable = await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-MANAGED-MARKETING-TAX-PAYABLE-ZAR", purpose: "MANAGED_MARKETING_TAX_PAYABLE", category: "LIABILITY", currency: "ZAR" });
    const { held, revenue } = await AdvertisingFundingService.getPlatformAccounts();
    return runSerializableTransaction(async (tx: any) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { managedMarketingRequest: true, successLedgerJournal: true, successfulAttempt: true, successWebhookEvent: true } });
      if (!payment?.managedMarketingRequest || payment.subjectType !== "MANAGED_MARKETING_REQUEST" || payment.purpose !== "AD_PURCHASE" || payment.status !== "SUCCEEDED" || payment.currency !== "ZAR" || !payment.successLedgerJournal || payment.successfulAttempt?.status !== "SUCCEEDED" || payment.successWebhookEvent?.processingStatus !== "APPLIED" || !payment.successWebhookEvent.signatureVerified || !payment.successWebhookEvent.merchantVerified || !payment.successWebhookEvent.amountVerified || !payment.successWebhookEvent.providerDataVerified) throw new ManagedMarketingRequestError("MANAGED_MARKETING_BILLING_EVIDENCE_INVALID", "Verified managed marketing payment evidence is incomplete.");
      const existing = await tx.managedMarketingBillingEvidence.findUnique({ where: { paymentId } });
      if (existing) return existing;
      const request = payment.managedMarketingRequest;
      const amounts = this.committedCommercialAmounts(request);
      if (!payment.amount.equals(amounts.gross)) throw new ManagedMarketingRequestError("MANAGED_MARKETING_BILLING_EVIDENCE_INVALID", "Verified payment amount does not match committed managed marketing commercial evidence.");
      const heldAccount = await tx.ledgerAccount.findFirst({ where: { id: held.id, status: "ACTIVE" }, select: { id: true } });
      if (!heldAccount) throw new ManagedMarketingRequestError("MANAGED_MARKETING_BILLING_EVIDENCE_INVALID", "Canonical verified payment holding account is unavailable.");
      const entries: Array<{ accountId: string; direction: "DEBIT" | "CREDIT"; amount: string; lineCode: string }> = [{ accountId: heldAccount.id, direction: "DEBIT", amount: amounts.gross.toFixed(2), lineCode: "MM_REVENUE_HELD_DEBIT" }, { accountId: revenue.id, direction: "CREDIT", amount: amounts.revenue.toFixed(2), lineCode: "MM_REVENUE_CREDIT" }];
      if (amounts.tax.greaterThan(0)) entries.push({ accountId: taxPayable.id, direction: "CREDIT", amount: amounts.tax.toFixed(2), lineCode: "MM_TAX_PAYABLE_CREDIT" });
      const revenueJournal = await postLedgerJournalWithinTransaction(tx, { idempotencyKey: `MM-REVENUE-${payment.id}`, type: "ACCOUNT_TRANSFER", currency: "ZAR", sourceReference: `mm_revenue:${request.publicReference}`, correlationId: payment.publicReference, memo: `Managed marketing revenue recognition ${request.publicReference}`, actor: { kind: "SYSTEM" }, entries });
      const evidence = await tx.managedMarketingBillingEvidence.create({ data: { managedMarketingRequestId: request.id, paymentId: payment.id, receiptLedgerJournalId: payment.successLedgerJournal.id, revenueLedgerJournalId: revenueJournal.id, grossAmount: amounts.gross, revenueAmount: amounts.revenue, taxAmount: amounts.tax, currency: "ZAR", operationId: `verified-payment:${payment.id}` } });
      await tx.managedMarketingRequest.update({ where: { id: request.id }, data: { paymentReference: payment.publicReference, ledgerJournalId: revenueJournal.id, events: { create: { operationId: `billing-recognized:${payment.id}`, eventType: "BILLING_RECOGNIZED", actorUserId: null, safeEvidence: { paymentReference: payment.publicReference, receiptLedgerJournalReference: payment.successLedgerJournal.reference, revenueLedgerJournalReference: revenueJournal.reference, grossAmount: amounts.gross.toFixed(2), revenueAmount: amounts.revenue.toFixed(2), taxAmount: amounts.tax.toFixed(2), currency: "ZAR" } } } } });
      return evidence;
    }, { operationName: `managed_marketing_recognize_payment:${paymentId}` });
  }

  async requireApprovedForExecution(reference: string) {
    const request = await this.getReviewRequest(reference);
    if (request.status !== "APPROVED") throw new ManagedMarketingRequestError("MANAGED_MARKETING_EXECUTION_NOT_APPROVED", "Only approved marketing requests may proceed to execution.");
    return request;
  }

  // Legacy callers are redirected to the ownership-checked aggregate entry point.
  async create(input: any) { return this.createDraft(input); }
}
