import { Prisma } from "@prisma/client";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import {
  assertStorefrontEditorialTransition,
  collectionIsEffective,
  STOREFRONT_COLLECTION_TARGET_TYPES,
  type StorefrontCollectionTargetType,
  type StorefrontEditorialStatus,
} from "@/lib/storefront/storefront-editorial-policy";
import { prisma } from "@/lib/db/prisma";

type CollectionRow = Readonly<{ id: string; publicReference: string; name: string; slug: string; description: string | null; status: StorefrontEditorialStatus; collectionType: "EDITORIAL" | "SEASONAL" | "CATEGORY_LANDING"; effectiveFrom: Date | null; effectiveUntil: Date | null; seoIndexable: boolean; version: number; createdAt: Date; updatedAt: Date }>;
type ItemRow = Readonly<{ id: string; targetType: StorefrontCollectionTargetType; targetReference: string; sourceVersion: string; displayOrder: number; safeLabelOverride: string | null; removedAt?: Date | null; createdAt: Date }>;

type StorefrontCollectionDb = {
  $transaction<T>(callback: (tx: StorefrontCollectionDb) => Promise<T>): Promise<T>;
  $queryRaw<T>(query: unknown): Promise<T>;
  storefrontCollection: {
    create(args: unknown): Promise<CollectionRow>;
    findUnique(args: unknown): Promise<(CollectionRow & { items?: ItemRow[]; history?: unknown[] }) | null>;
    findMany(args: unknown): Promise<CollectionRow[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  storefrontCollectionItem: {
    create(args: unknown): Promise<ItemRow>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  storefrontCollectionLifecycleHistory: { create(args: unknown): Promise<unknown> };
};

function asDb(value: unknown): StorefrontCollectionDb { return value as StorefrontCollectionDb; }

export class StorefrontCollectionError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "StorefrontCollectionError"; }
}

function assertDraft(record: CollectionRow): void {
  if (record.status !== "DRAFT") throw new StorefrontCollectionError("COLLECTION_IMMUTABLE", "Only draft collections may be edited.");
}
function assertOptimisticVersion(record: CollectionRow, version: number): void {
  if (record.version !== version) throw new StorefrontCollectionError("COLLECTION_VERSION_CONFLICT", "This collection has changed. Reload it before editing.");
}
function assertWindow(effectiveFrom?: Date | null, effectiveUntil?: Date | null): void {
  if (effectiveFrom && effectiveUntil && effectiveUntil <= effectiveFrom) throw new StorefrontCollectionError("INVALID_EFFECTIVE_WINDOW", "The collection end must be after its start.");
}
function transitionTarget(action: "submit" | "approve" | "reject" | "activate" | "retire"): StorefrontEditorialStatus {
  return ({ submit: "UNDER_REVIEW", approve: "APPROVED", reject: "REJECTED", activate: "ACTIVE", retire: "RETIRED" } as const)[action];
}

export type CollectionTargetEvidence = Readonly<{ targetType: StorefrontCollectionTargetType; targetReference: string; sourceVersion: string }>;

/** Resolves eligibility only from storefront projections, never catalog drafts. */
export async function resolveStorefrontCollectionTarget(db: StorefrontCollectionDb, targetType: StorefrontCollectionTargetType, targetReference: string): Promise<CollectionTargetEvidence | null> {
  if (!STOREFRONT_COLLECTION_TARGET_TYPES.includes(targetType)) return null;
  if (targetType === "PRODUCT" || targetType === "VARIANT") {
    const column = targetType === "PRODUCT" ? Prisma.raw('"productPublicReference"') : Prisma.raw('"variantPublicReference"');
    const rows = await db.$queryRaw<Array<{ sourceVersion: string }>>(Prisma.sql`SELECT "publicationVersion" AS "sourceVersion" FROM "StorefrontProductDocument" WHERE ${column} = ${targetReference} AND "status" = 'ACTIVE' AND "searchable" = true ORDER BY "priceAmount" ASC, "publicReference" ASC LIMIT 1`);
    return rows[0] ? { targetType, targetReference, sourceVersion: rows[0].sourceVersion } : null;
  }
  if (targetType === "CATEGORY") {
    const rows = await db.$queryRaw<Array<{ sourceVersion: number }>>(Prisma.sql`SELECT "projectionVersion" AS "sourceVersion" FROM "StorefrontCategoryDocument" WHERE "categoryPublicReference" = ${targetReference} AND "productCount" > 0 LIMIT 1`);
    return rows[0] ? { targetType, targetReference, sourceVersion: `category:${targetReference}:${rows[0].sourceVersion}` } : null;
  }
  const rows = await db.$queryRaw<Array<{ sourceVersion: number }>>(Prisma.sql`SELECT "projectionVersion" AS "sourceVersion" FROM "StorefrontStoreDocument" WHERE "storePublicReference" = ${targetReference} AND "publicStatus" = 'ACTIVE' AND "publishedOfferCount" > 0 LIMIT 1`);
  return rows[0] ? { targetType, targetReference, sourceVersion: `store:${targetReference}:${rows[0].sourceVersion}` } : null;
}

export class StorefrontCollectionService {
  constructor(private readonly db: StorefrontCollectionDb = asDb(prisma)) {}

  async list() { return this.db.storefrontCollection.findMany({ orderBy: [{ updatedAt: "desc" }, { publicReference: "asc" }], take: 100 }); }

  async get(publicReference: string) {
    return this.db.storefrontCollection.findUnique({ where: { publicReference }, include: { items: { orderBy: [{ displayOrder: "asc" }, { id: "asc" }] }, history: { orderBy: { createdAt: "asc" } } } });
  }

  async create(input: Readonly<{ name: string; slug: string; description?: string | null; collectionType: "EDITORIAL" | "SEASONAL" | "CATEGORY_LANDING"; effectiveFrom?: Date | null; effectiveUntil?: Date | null; seoIndexable?: boolean; actorUserId: string; operationId: string }>) {
    assertWindow(input.effectiveFrom, input.effectiveUntil);
    return this.db.$transaction(async (tx) => {
      const collection = await tx.storefrontCollection.create({ data: { publicReference: catalogPublicReference("SFC"), name: input.name, slug: input.slug, description: input.description ?? null, collectionType: input.collectionType, effectiveFrom: input.effectiveFrom ?? null, effectiveUntil: input.effectiveUntil ?? null, seoIndexable: false, createdByUserId: input.actorUserId } });
      await tx.storefrontCollectionLifecycleHistory.create({ data: { collectionId: collection.id, fromStatus: null, toStatus: "DRAFT", actorUserId: input.actorUserId, operationId: input.operationId, safeSummary: "Editorial collection draft was created." } });
      return collection;
    });
  }

  async update(publicReference: string, input: Readonly<{ version: number; name?: string; description?: string | null; effectiveFrom?: Date | null; effectiveUntil?: Date | null; seoIndexable?: boolean; actorUserId: string; operationId: string }>) {
    const collection = await this.require(publicReference);
    assertDraft(collection); assertOptimisticVersion(collection, input.version);
    const effectiveFrom = input.effectiveFrom === undefined ? collection.effectiveFrom : input.effectiveFrom;
    const effectiveUntil = input.effectiveUntil === undefined ? collection.effectiveUntil : input.effectiveUntil;
    assertWindow(effectiveFrom, effectiveUntil);
    const update = await this.db.storefrontCollection.updateMany({ where: { id: collection.id, version: input.version, status: "DRAFT" }, data: { ...(input.name === undefined ? {} : { name: input.name }), ...(input.description === undefined ? {} : { description: input.description }), ...(input.effectiveFrom === undefined ? {} : { effectiveFrom: input.effectiveFrom }), ...(input.effectiveUntil === undefined ? {} : { effectiveUntil: input.effectiveUntil }), ...(input.seoIndexable === undefined ? {} : { seoIndexable: false }), version: { increment: 1 } } });
    if (!update.count) throw new StorefrontCollectionError("COLLECTION_VERSION_CONFLICT", "This collection has changed. Reload it before editing.");
    return this.require(publicReference);
  }

  async addItem(publicReference: string, input: Readonly<{ version: number; targetType: StorefrontCollectionTargetType; targetReference: string; displayOrder: number; safeLabelOverride?: string | null; actorUserId: string; operationId: string }>) {
    const collection = await this.require(publicReference); assertDraft(collection); assertOptimisticVersion(collection, input.version);
    const evidence = await resolveStorefrontCollectionTarget(this.db, input.targetType, input.targetReference);
    if (!evidence) throw new StorefrontCollectionError("COLLECTION_TARGET_INELIGIBLE", "The selected storefront target is not publicly eligible.");
    return this.db.$transaction(async (tx) => {
      const item = await tx.storefrontCollectionItem.create({ data: { collectionId: collection.id, targetType: evidence.targetType, targetReference: evidence.targetReference, sourceVersion: evidence.sourceVersion, displayOrder: input.displayOrder, safeLabelOverride: input.safeLabelOverride ?? null } });
      const updated = await tx.storefrontCollection.updateMany({ where: { id: collection.id, version: input.version, status: "DRAFT" }, data: { version: { increment: 1 } } });
      if (!updated.count) throw new StorefrontCollectionError("COLLECTION_VERSION_CONFLICT", "This collection has changed. Reload it before editing.");
      return item;
    });
  }

  async updateItem(publicReference: string, itemId: string, input: Readonly<{ version: number; displayOrder?: number; safeLabelOverride?: string | null; actorUserId: string; operationId: string }>) {
    const collection = await this.require(publicReference); assertDraft(collection); assertOptimisticVersion(collection, input.version);
    const result = await this.db.$transaction(async (tx) => {
      const update = await tx.storefrontCollectionItem.updateMany({ where: { id: itemId, collectionId: collection.id }, data: { ...(input.displayOrder === undefined ? {} : { displayOrder: input.displayOrder }), ...(input.safeLabelOverride === undefined ? {} : { safeLabelOverride: input.safeLabelOverride }) } });
      if (!update.count) throw new StorefrontCollectionError("COLLECTION_ITEM_NOT_FOUND", "The collection item is unavailable.");
      const version = await tx.storefrontCollection.updateMany({ where: { id: collection.id, version: input.version, status: "DRAFT" }, data: { version: { increment: 1 } } });
      if (!version.count) throw new StorefrontCollectionError("COLLECTION_VERSION_CONFLICT", "This collection has changed. Reload it before editing.");
      return update;
    });
    return result;
  }

  async removeItem(publicReference: string, itemId: string, input: Readonly<{ version: number; actorUserId: string; operationId: string }>) {
    const collection = await this.require(publicReference); assertDraft(collection); assertOptimisticVersion(collection, input.version);
    // Historical evidence is retained: removal is a tombstone, never DELETE.
    const removed = await this.db.storefrontCollectionItem.updateMany({ where: { id: itemId, collectionId: collection.id, removedAt: null }, data: { removedAt: new Date(), removedByUserId: input.actorUserId } });
    if (!removed.count) throw new StorefrontCollectionError("COLLECTION_ITEM_NOT_FOUND", "The collection item is unavailable.");
    const version = await this.db.storefrontCollection.updateMany({ where: { id: collection.id, version: input.version, status: "DRAFT" }, data: { version: { increment: 1 } } });
    if (!version.count) throw new StorefrontCollectionError("COLLECTION_VERSION_CONFLICT", "This collection has changed. Reload it before editing.");
  }

  async transition(publicReference: string, action: "submit" | "approve" | "reject" | "activate" | "retire", input: Readonly<{ version: number; actorUserId: string; operationId: string }>) {
    const collection = await this.require(publicReference); assertOptimisticVersion(collection, input.version);
    const toStatus = transitionTarget(action); assertStorefrontEditorialTransition(collection.status, toStatus);
    const detail = await this.get(publicReference);
    if (!detail) throw new StorefrontCollectionError("COLLECTION_NOT_FOUND", "The collection is unavailable.");
    if (action === "activate") {
      if (!detail.items?.length || !collectionIsEffective({ ...collection, status: "ACTIVE" })) throw new StorefrontCollectionError("COLLECTION_NOT_ACTIVATABLE", "An active collection needs eligible items and a current effective window.");
      for (const item of detail.items) if (!item.removedAt && !await resolveStorefrontCollectionTarget(this.db, item.targetType, item.targetReference)) throw new StorefrontCollectionError("COLLECTION_TARGET_INELIGIBLE", "Every collection target must be publicly eligible before activation.");
    }
    return this.db.$transaction(async (tx) => {
      const update = await tx.storefrontCollection.updateMany({ where: { id: collection.id, version: input.version, status: collection.status }, data: { status: toStatus, ...(toStatus === "ACTIVE" ? { approvedByUserId: input.actorUserId } : {}), ...(toStatus === "ACTIVE" ? { seoIndexable: collection.seoIndexable } : { seoIndexable: false }), version: { increment: 1 } } });
      if (!update.count) throw new StorefrontCollectionError("COLLECTION_VERSION_CONFLICT", "This collection has changed. Reload it before editing.");
      await tx.storefrontCollectionLifecycleHistory.create({ data: { collectionId: collection.id, fromStatus: collection.status, toStatus, actorUserId: input.actorUserId, operationId: input.operationId, safeSummary: `Collection moved from ${collection.status} to ${toStatus} through reviewed lifecycle control.` } });
      return this.require(publicReference);
    });
  }

  private async require(publicReference: string): Promise<CollectionRow> {
    const value = await this.db.storefrontCollection.findUnique({ where: { publicReference } });
    if (!value) throw new StorefrontCollectionError("COLLECTION_NOT_FOUND", "The collection is unavailable.");
    return value;
  }
}
