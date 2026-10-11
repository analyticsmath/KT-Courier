import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "@/lib/client-platform/contracts";
import { publicParcelProfiles } from "@/lib/commercial/parcel-profiles";
import { classifyTrustedMarketplaceParcel, TrustedPackageVersionSchema, type TrustedPackageVersion } from "./parcel-classification";

const prefix = "production_marketplace_trusted_packages_v";
export const TrustedPackageDraftSchema = z.object({ packages: TrustedPackageVersionSchema.shape.packages, effectiveFrom: TrustedPackageVersionSchema.shape.effectiveFrom, effectiveTo: TrustedPackageVersionSchema.shape.effectiveTo, expectedVersion: z.number().int().nonnegative(), reason: z.string().trim().min(10).max(500) }).strict().refine(value => !value.effectiveTo || value.effectiveTo > value.effectiveFrom, "Effective end must follow start.");
export const TrustedPackageActionSchema = z.object({ version: z.number().int().positive(), expectedUpdatedAt: z.iso.datetime(), action: z.enum(["APPROVE", "ACTIVATE", "RETIRE"]), reason: z.string().trim().min(10).max(500) }).strict();

export async function listTrustedPackageVersions() {
  const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: prefix } }, orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({ ...TrustedPackageVersionSchema.parse(row.value), updatedAt: row.updatedAt.toISOString() }));
}

export async function saveTrustedPackageVersion(actorId: string, input: z.infer<typeof TrustedPackageDraftSchema>) {
  const data = TrustedPackageDraftSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    const rows = await tx.systemSetting.findMany({ where: { key: { startsWith: prefix } } });
    const latest = Math.max(0, ...rows.map((row) => TrustedPackageVersionSchema.parse(row.value).version));
    if (latest !== data.expectedVersion) throw new PlatformError("VERSION_CONFLICT", "Trusted packaging changed. Refresh before saving.", 409);
    for (const entry of data.packages) {
      const source = await tx.storeCatalogOffer.findUnique({ where: { publicReference: entry.offerReference }, include: { variant: true, publicationSnapshots: { where: { status: "PUBLISHED" }, orderBy: { versionNumber: "desc" }, take: 1 } } });
      // Checkout records the offer revision as publicationVersion. Snapshot
      // publication IDs use a separate namespace and cannot be compared to it.
      if (!source || source.status !== "ACTIVE" || source.publicationStatus !== "PUBLISHED" || String(source.version) !== entry.publicationVersion || source.storeId !== entry.storeId || source.variant.publicReference !== entry.variantReference || source.publicationSnapshots.length !== 1) throw new PlatformError("PACKAGE_SOURCE_INVALID", "Packaging must identify the actual published store offer, variant and current revision.", 422);
      if (new Set(entry.modifiers.map((modifier) => modifier.optionReference)).size !== entry.modifiers.length) throw new PlatformError("PACKAGE_SOURCE_INVALID", "Modifier selections must be unique.", 422);
    }
    const { expectedVersion, reason, ...draft } = data;
    const value: TrustedPackageVersion = { ...draft, version: expectedVersion + 1, status: "DRAFT", createdByUserId: actorId, approvedByUserId: null, approvedAt: null };
    const row = await tx.systemSetting.create({ data: { key: prefix + value.version, label: "Trusted marketplace packaging", type: "JSON", value: value as unknown as Prisma.InputJsonValue } });
    await tx.adminActivityLog.create({ data: { actorUserId: actorId, action: "CREATE", entityType: "MarketplaceTrustedPackaging", entityId: row.id, message: reason, metadata: { version: value.version, status: value.status, packageCount: value.packages.length } } });
    return value;
  });
}

export async function actOnTrustedPackageVersion(actorId: string, input: z.infer<typeof TrustedPackageActionSchema>) {
  const data = TrustedPackageActionSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    const row = await tx.systemSetting.findUnique({ where: { key: prefix + data.version } });
    if (!row || row.updatedAt.toISOString() !== data.expectedUpdatedAt) throw new PlatformError("VERSION_CONFLICT", "Trusted packaging changed. Refresh before review.", 409);
    const prior = TrustedPackageVersionSchema.parse(row.value); const next = { ...prior };
    if (data.action === "APPROVE") {
      if (prior.status !== "DRAFT" || prior.createdByUserId === actorId) throw new PlatformError("INDEPENDENT_REVIEW_REQUIRED", "A different authorized administrator must review the measured package evidence.", 403);
      next.status = "APPROVED"; next.approvedByUserId = actorId; next.approvedAt = new Date().toISOString();
    } else if (data.action === "ACTIVATE") {
      if (prior.status !== "APPROVED" || !prior.approvedAt || !prior.approvedByUserId || prior.approvedByUserId === prior.createdByUserId) throw new PlatformError("APPROVAL_REQUIRED", "Independent packaging approval is required before activation.", 409);
      next.status = "ACTIVE";
    } else next.status = "RETIRED";
    await tx.systemSetting.update({ where: { id: row.id, updatedAt: row.updatedAt }, data: { value: next as unknown as Prisma.InputJsonValue } });
    await tx.adminActivityLog.create({ data: { actorUserId: actorId, action: "UPDATE", entityType: "MarketplaceTrustedPackaging", entityId: row.id, message: data.reason, metadata: { version: next.version, beforeStatus: prior.status, afterStatus: next.status } } });
    return next;
  });
}

/** Reads immutable checkout snapshots; request fields never supply package facts. */
export async function classifyPersistedCheckoutParcel(checkoutReference: string | undefined, storeId: string) {
  const checkout = checkoutReference ? await prisma.marketplaceCheckout.findUnique({ where: { publicReference: checkoutReference }, select: { reviewVersion: true, lines: { where: { storeReference: storeId }, include: { modifiers: true } } } }) : null;
  const lines = checkout?.lines.filter((line) => line.reviewVersion === checkout.reviewVersion) ?? [];
  if (lines.length) {
    const offers = await prisma.storeCatalogOffer.findMany({ where: { publicReference: { in: lines.map((line) => line.offerReference) }, storeId, status: "ACTIVE", publicationStatus: "PUBLISHED" }, include: { variant: true } });
    if (lines.some((line) => !offers.some((offer) => offer.publicReference === line.offerReference && offer.variant.publicReference === line.variantReference && String(offer.version) === line.publicationVersion))) {
      return { sizeClass: null, status: "UNKNOWN" as const, reason: "PACKAGE_SOURCE_REVISION_STALE", packageVersion: null, profileId: null, profileVersion: null };
    }
  }
  return classifyTrustedMarketplaceParcel({ storeId, lines, versions: await listTrustedPackageVersions(), profiles: await publicParcelProfiles() });
}
