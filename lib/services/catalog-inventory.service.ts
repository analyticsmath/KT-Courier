import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { applyInventoryDelta, inventoryProjection } from "@/lib/catalog/catalog-inventory-policy";
import { catalogPublicReference, catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export async function listStoreInventory(storeId: string) {
  return prisma.catalogInventoryItem.findMany({
    where: { offer: { storeId } },
    include: { offer: { include: { product: { select: { publicReference: true, title: true } }, variant: { select: { publicReference: true, title: true } } } }, levels: { include: { location: true } }, movements: { orderBy: { createdAt: "desc" }, take: 10 } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function postCatalogInventoryMovement(storeId: string, actorUserId: string, inventoryPublicReference: string, input: {
  type: "INITIAL_STOCK" | "STOCK_RECEIPT" | "STOCK_COUNT_CORRECTION" | "DAMAGE" | "LOSS" | "RETURN_TO_STOCK" | "MANUAL_CORRECTION" | "REMOVAL";
  quantityDelta: number;
  locationPublicReference: string;
  operationId: string;
  reasonCode: string;
  safeNote?: string;
  version: number;
}) {
  const requestHash = catalogRequestHash({ inventoryPublicReference, ...input });
  return prisma.$transaction(async (tx) => {
    const item = await tx.catalogInventoryItem.findUnique({ where: { publicReference: inventoryPublicReference }, include: { offer: true } });
    if (!item) throw new CatalogNotFoundError("Catalog inventory item was not found.");
    if (item.offer.storeId !== storeId) throw new CatalogOwnershipError();
    if (item.trackingMode !== "TRACKED") throw new CatalogPolicyError("INVENTORY_NOT_TRACKED", "Numeric movements apply only to tracked inventory.");
    const replay = await tx.catalogInventoryMovement.findUnique({ where: { inventoryItemId_operationId: { inventoryItemId: item.id, operationId: input.operationId } } });
    if (replay) {
      if (replay.requestHash !== requestHash) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "Operation ID was already used with a different inventory request.");
      return replay;
    }
    const location = await tx.inventoryLocation.findFirst({ where: { publicReference: input.locationPublicReference, storeId, status: "ACTIVE" } });
    if (!location) throw new CatalogOwnershipError();
    await tx.$queryRaw`SELECT "id" FROM "CatalogInventoryItem" WHERE "id" = ${item.id} FOR UPDATE`;
    const level = await tx.catalogInventoryLevel.upsert({
      where: { inventoryItemId_locationId: { inventoryItemId: item.id, locationId: location.id } },
      update: {},
      create: { inventoryItemId: item.id, locationId: location.id, onHand: 0, reserved: 0, available: 0 },
    });
    if (item.version !== input.version) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Inventory changed; reload before posting a movement.");
    const projected = applyInventoryDelta(inventoryProjection(level.onHand, level.reserved), input.quantityDelta);
    const updatedItem = await tx.catalogInventoryItem.updateMany({ where: { id: item.id, version: input.version }, data: { version: { increment: 1 } } });
    if (updatedItem.count !== 1) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Inventory changed; reload before posting a movement.");
    await tx.catalogInventoryLevel.update({ where: { id: level.id }, data: { ...projected, version: { increment: 1 } } });
    const movement = await tx.catalogInventoryMovement.create({ data: { publicReference: catalogPublicReference("CIM"), inventoryItemId: item.id, locationId: location.id, type: input.type, quantityDelta: input.quantityDelta, operationId: input.operationId, requestHash, reasonCode: input.reasonCode, safeNote: input.safeNote, actorUserId, resultingOnHand: projected.onHand } });
    await recordCatalogEvidence(tx, { aggregateType: "INVENTORY", aggregateReference: item.publicReference, aggregateVersion: item.version + 1, action: input.type, eventType: "INVENTORY_CHANGED", actorUserId, reasonCode: input.reasonCode, safeMetadata: { locationReference: location.publicReference, resultingOnHand: projected.onHand } });
    return movement;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

