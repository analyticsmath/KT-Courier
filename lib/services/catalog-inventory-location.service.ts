import { prisma } from "@/lib/db/prisma";
import { catalogPublicReference, catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { CatalogConflictError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { InventoryLocationCreateSchema, type InventoryLocationCreateInput } from "@/lib/validation/inventory-location";
import { recordCatalogEvidence } from "./catalog-service-support";

const ACTION = "INVENTORY:LOCATION_CREATED";
const projection = { publicReference: true, name: true, status: true, isPrimary: true, version: true } as const;

export async function listStoreInventoryLocations(storeId: string) {
  return prisma.inventoryLocation.findMany({ where: { storeId }, select: projection, orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 100 });
}

/** Creates stock organization only; grants no delivery coverage or publication approval. */
export async function createStoreInventoryLocation(storeId: string, actorUserId: string, raw: InventoryLocationCreateInput) {
  const parsed = InventoryLocationCreateSchema.safeParse(raw);
  if (!parsed.success) throw new CatalogPolicyError("INVENTORY_LOCATION_INVALID", "Review the stock location name.");
  const input = parsed.data;
  const hash = catalogRequestHash(input);
  return prisma.$transaction(async tx => {
    // Serialize first-location selection, duplicate-name checks and receipts per store.
    await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`;
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { status: true } });
    if (store?.status !== "ACTIVE") throw new CatalogOwnershipError();
    const receipt = await tx.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: { actorUserId, action: ACTION, operationId: input.operationId } } });
    if (receipt) {
      if (receipt.storeId !== storeId || receipt.requestHash !== hash || !receipt.aggregateReference) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "This operation was used for another stock location.");
      return tx.inventoryLocation.findFirstOrThrow({ where: { storeId, publicReference: receipt.aggregateReference }, select: projection });
    }
    const duplicate = await tx.inventoryLocation.findFirst({ where: { storeId, name: { equals: input.name, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) throw new CatalogConflictError("INVENTORY_LOCATION_EXISTS", "A stock location with this name already exists.");
    const count = await tx.inventoryLocation.count({ where: { storeId } });
    if (count >= 100) throw new CatalogPolicyError("INVENTORY_LOCATION_LIMIT", "This store has reached its stock location limit.");
    const location = await tx.inventoryLocation.create({ data: { publicReference: catalogPublicReference("IL"), storeId, name: input.name, status: "ACTIVE", isPrimary: count === 0 }, select: projection });
    await recordCatalogEvidence(tx, { aggregateType: "INVENTORY", aggregateReference: location.publicReference, aggregateVersion: location.version, action: "LOCATION_CREATED", eventType: "INVENTORY_CHANGED", actorUserId, safeMetadata: { storeId, locationReference: location.publicReference }, operation: { operationId: input.operationId, storeId, request: input } });
    return location;
  });
}
