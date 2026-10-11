import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseInventoryUpload } from "@/lib/catalog/inventory-upload-policy";
import { CatalogConflictError, CatalogOwnershipError } from "@/lib/catalog/errors";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { postCatalogInventoryMovement } from "./catalog-inventory.service";

export async function uploadCatalogInventory(storeId: string, actorUserId: string, input: { csv: string; operationId: string; dryRun: boolean }) {
  const rows = parseInventoryUpload(input.csv);
  const requestHash = catalogRequestHash({ storeId, rows });
  const reference = `CIB-${createHash("sha256").update(JSON.stringify([actorUserId, storeId, input.operationId])).digest("hex")}`;
  const child = (index: number) => `csv:${createHash("sha256").update(JSON.stringify([reference, index])).digest("hex")}`;
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reference}, 0))`;
    const replay = await tx.catalogOperationReceipt.findUnique({ where: { actorUserId_action_operationId: { actorUserId, action: "INVENTORY:CSV_RECEIPT", operationId: input.operationId } } });
    if (replay && (replay.storeId !== storeId || replay.requestHash !== requestHash)) throw new CatalogConflictError("OPERATION_REPLAY_MISMATCH", "Upload operation was already used with different stock rows.");
    if (replay) return { reference, replayed: true, dryRun: false, movements: await tx.catalogInventoryMovement.findMany({ where: { operationId: { in: rows.map((_, index) => child(index)) }, inventoryItem: { offer: { storeId } } }, orderBy: { operationId: "asc" } }) };
    // Lock all items in stable order before checking every row or writing any movement.
    const refs = rows.map(row => row.inventoryReference).sort();
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CatalogInventoryItem" WHERE "publicReference" IN (${Prisma.join(refs)}) ORDER BY "id" FOR UPDATE`);
    const preview = [];
    for (const row of rows) {
      const item = await tx.catalogInventoryItem.findFirst({ where: { publicReference: row.inventoryReference, offer: { storeId }, trackingMode: "TRACKED" } });
      const location = await tx.inventoryLocation.findFirst({ where: { publicReference: row.locationReference, storeId, status: "ACTIVE" } });
      if (!item || !location) throw new CatalogOwnershipError();
      if (item.version !== row.version) throw new CatalogConflictError("CATALOG_VERSION_CONFLICT", "Inventory changed; download a fresh template and review it again.");
      const level = await tx.catalogInventoryLevel.findUnique({ where: { inventoryItemId_locationId: { inventoryItemId: item.id, locationId: location.id } } });
      if ((level?.onHand ?? 0) + row.quantity > 2_147_483_647) throw new CatalogConflictError("INVENTORY_UPLOAD_LIMIT", "Resulting stock exceeds the supported whole-unit limit.");
      preview.push({ ...row, onHand: level?.onHand ?? 0, resultingOnHand: (level?.onHand ?? 0) + row.quantity, reserved: level?.reserved ?? 0 });
    }
    if (input.dryRun) return { reference, dryRun: true, replayed: false, preview };
    const movements = [];
    for (const [index, row] of rows.entries()) movements.push(await postCatalogInventoryMovement(storeId, actorUserId, row.inventoryReference, { type: "STOCK_RECEIPT", quantityDelta: row.quantity, locationPublicReference: row.locationReference, operationId: child(index), reasonCode: "CSV_STOCK_RECEIPT", safeNote: reference, version: row.version }, tx));
    await tx.catalogOperationReceipt.create({ data: { storeId, actorUserId, operationId: input.operationId, action: "INVENTORY:CSV_RECEIPT", requestHash, aggregateReference: reference } });
    return { reference, dryRun: false, replayed: false, movements };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
