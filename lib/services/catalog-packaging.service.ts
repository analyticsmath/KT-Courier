import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CatalogPackagingSchema, type CatalogPackaging } from "@/lib/validation/catalog-packaging";
import { publicParcelProfiles } from "@/lib/commercial/parcel-profiles";
import { packageFitsLimits } from "@/lib/catalog/package-fit";
import { CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { isApprovedCertProofOffer, syncStoreReadinessAfterCatalogOfferChange } from "@/lib/admin/store-readiness-sync";
export const PACKAGING_PREFIX = "vendor_catalog_packaging:";
export type PackagingDeclaration = CatalogPackaging & { offerReference: string; storeId: string; actorUserId: string; revision: string; submittedAt: string };
/** Resolve the exact current vendor submission rather than searching the most
 * recent page. Commercial approval still requires independent review. */
export async function findCatalogPackagingDeclaration(offerReference: string, revision: string): Promise<PackagingDeclaration | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: PACKAGING_PREFIX + offerReference } });
  const source = row?.value as Partial<PackagingDeclaration> | null | undefined;
  if (!source || source.offerReference !== offerReference || source.revision !== revision ||
    typeof source.storeId !== "string" || !source.storeId ||
    typeof source.actorUserId !== "string" || !source.actorUserId ||
    typeof source.submittedAt !== "string" || Number.isNaN(Date.parse(source.submittedAt))) return null;
  const measurements = CatalogPackagingSchema.safeParse({
    lengthCm: source.lengthCm, widthCm: source.widthCm, heightCm: source.heightCm,
    weightKg: source.weightKg, description: source.description,
  });
  return measurements.success
    ? { ...measurements.data, offerReference, storeId: source.storeId, actorUserId: source.actorUserId, revision, submittedAt: source.submittedAt }
    : null;
}

/** Resolve and validate current seller declarations for the offers shown in a
 * vendor onboarding projection without loading unrelated stores' settings. */
export async function listCatalogPackagingForOffers(storeId: string, offerReferences: readonly string[]) {
  if (offerReferences.length === 0) return [] as PackagingDeclaration[];
  const references = new Set(offerReferences);
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: offerReferences.map((reference) => PACKAGING_PREFIX + reference) } },
    select: { key: true, value: true },
  });
  const declarations: PackagingDeclaration[] = [];
  for (const row of rows) {
    const source = row.value as Partial<PackagingDeclaration> | null;
    if (
      !source ||
      typeof source.offerReference !== "string" ||
      !references.has(source.offerReference) ||
      row.key !== PACKAGING_PREFIX + source.offerReference ||
      source.storeId !== storeId ||
      typeof source.actorUserId !== "string" ||
      !source.actorUserId ||
      typeof source.revision !== "string" ||
      !source.revision ||
      typeof source.submittedAt !== "string" ||
      Number.isNaN(Date.parse(source.submittedAt))
    ) continue;
    const measurements = CatalogPackagingSchema.safeParse({
      lengthCm: source.lengthCm,
      widthCm: source.widthCm,
      heightCm: source.heightCm,
      weightKg: source.weightKg,
      description: source.description,
    });
    if (measurements.success) {
      declarations.push({
        ...measurements.data,
        offerReference: source.offerReference,
        storeId,
        actorUserId: source.actorUserId,
        revision: source.revision,
        submittedAt: source.submittedAt,
      });
    }
  }
  return declarations;
}

export async function saveCatalogPackaging(storeId: string, actorUserId: string, offerReference: string, raw: CatalogPackaging, transaction?: Prisma.TransactionClient) {
  const input = CatalogPackagingSchema.parse(raw);
  const limits = await publicParcelProfiles();
  if (limits.length && !packageFitsLimits(input, limits)) throw new CatalogPolicyError("PACKAGE_LIMIT_EXCEEDED", "This packed unit exceeds the active courier size or weight limits. Split or repack the product before submitting it for delivery.");
  const save = async (tx: Prisma.TransactionClient) => {
    const offer = await tx.storeCatalogOffer.findFirst({ where: { publicReference: offerReference, storeId }, select: { id: true } });
    if (!offer) throw new CatalogOwnershipError();
    const value: PackagingDeclaration = { ...input, offerReference, storeId, actorUserId, revision: randomUUID(), submittedAt: new Date().toISOString() };
    const data = { label: "Vendor measured delivery package", type: "JSON" as const, value: value as unknown as Prisma.InputJsonValue };
    await tx.systemSetting.upsert({ where: { key: PACKAGING_PREFIX + offerReference }, create: { key: PACKAGING_PREFIX + offerReference, ...data }, update: data });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "UPDATE", entityType: "VendorCatalogPackaging", entityId: offer.id, message: "Vendor submitted packaged dimensions and weight for operational review.", metadata: { offerReference, storeId, revision: value.revision } } });
    if (typeof (tx as unknown as { store?: { update?: unknown } }).store?.update === "function") {
      const offerState = await tx.storeCatalogOffer.findFirst({
        where: { id: offer.id },
        select: { status: true, publicationStatus: true },
      });
      if (
        offerState &&
        (offerState.status === "ACTIVE" ||
          offerState.publicationStatus === "PUBLISHED" ||
          (await isApprovedCertProofOffer(tx, storeId, offerReference)))
      ) {
        await syncStoreReadinessAfterCatalogOfferChange(tx, storeId, [offerReference]);
      }
    }
    return value;
  };
  return transaction ? save(transaction) : prisma.$transaction(save);
}

/** A bounded, stable admin listing; older submissions remain retrievable. */
export async function listCatalogPackagingPage(cursor?: string) {
  const pageSize = 100;
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: PACKAGING_PREFIX } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return {
    declarations: rows.slice(0, pageSize).map(row => row.value as unknown as PackagingDeclaration),
    nextCursor: rows.length > pageSize ? rows[pageSize - 1]!.id : null,
  };
}
export async function listCatalogPackaging(storeId?: string) {
  const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: PACKAGING_PREFIX } }, orderBy: { updatedAt: "desc" }, take: 500 });
  return rows.map(row => row.value as unknown as PackagingDeclaration).filter(value => !storeId || value.storeId === storeId);
}
