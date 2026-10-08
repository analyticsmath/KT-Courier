import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { postCatalogInventoryMovement } from "@/lib/services/catalog-inventory.service";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation, catalogEvidence } from "./catalog-canonical-support";
import { uploadCatalogInventory } from "@/lib/services/catalog-inventory-upload.service";
import { INVENTORY_UPLOAD_HEADER } from "@/lib/catalog/inventory-upload-policy";

describeCatalogIntegration("canonical catalog inventory", () => {
  it("previews and atomically posts CSV receipts once with payload-bound replay", async () => {
    const f = await catalogFoundation();
    const csv = `${INVENTORY_UPLOAD_HEADER}\n${f.inventory.publicReference},${f.location.publicReference},${f.inventory.version},3`;
    const command = { csv, operationId: randomUUID(), dryRun: true };
    const preview = await uploadCatalogInventory(f.store.id, f.user.id, command);
    expect(preview).toMatchObject({ dryRun: true, preview: [{ onHand: 0, resultingOnHand: 3, quantity: 3 }] });
    expect(await prisma.catalogInventoryMovement.count({ where: { inventoryItemId: f.inventory.id } })).toBe(0);
    expect(await prisma.catalogInventoryLevel.count({ where: { inventoryItemId: f.inventory.id } })).toBe(0);
    const posted = await uploadCatalogInventory(f.store.id, f.user.id, { ...command, dryRun: false });
    expect(posted).toMatchObject({ replayed: false, movements: [{ quantityDelta: 3, type: "STOCK_RECEIPT" }] });
    const before = await prisma.catalogInventoryLevel.findFirstOrThrow({ where: { inventoryItemId: f.inventory.id } });
    expect(before).toMatchObject({ onHand: 3, reserved: 0, available: 3 });
    expect(await uploadCatalogInventory(f.store.id, f.user.id, { ...command, dryRun: false })).toMatchObject({ replayed: true, movements: posted.movements });
    await expect(uploadCatalogInventory(f.store.id, f.user.id, { ...command, csv: csv.replace(/,3$/, ",4"), dryRun: false })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    expect(await prisma.catalogInventoryLevel.findUnique({ where: { id: before.id } })).toEqual(before);
    expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: f.user.id, action: "INVENTORY:CSV_RECEIPT" } })).toBe(1);
  });
  it("rejects stale or foreign rows atomically without partial stock or receipts", async () => {
    const f = await catalogFoundation(); const foreign = await catalogFoundation();
    const good = `${f.inventory.publicReference},${f.location.publicReference},${f.inventory.version},2`;
    const command = { csv: `${INVENTORY_UPLOAD_HEADER}\n${good}\n${foreign.inventory.publicReference},${foreign.location.publicReference},${foreign.inventory.version},2`, operationId: randomUUID(), dryRun: false };
    const receiptsBefore = await prisma.catalogOperationReceipt.findMany({ where: { actorUserId: f.user.id }, orderBy: { id: "asc" } });
    const inventoryBefore = await prisma.catalogInventoryItem.findMany({ where: { id: { in: [f.inventory.id, foreign.inventory.id] } }, orderBy: { id: "asc" } });
    await expect(uploadCatalogInventory(f.store.id, f.user.id, command)).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    await expect(uploadCatalogInventory(f.store.id, f.user.id, { ...command, csv: `${INVENTORY_UPLOAD_HEADER}\n${good.replace(`,${f.inventory.version},2`, `,${f.inventory.version + 1},2`)}` })).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
    expect(await prisma.catalogInventoryMovement.count({ where: { inventoryItemId: { in: [f.inventory.id, foreign.inventory.id] } } })).toBe(0);
    expect(await prisma.catalogOperationReceipt.findMany({ where: { actorUserId: f.user.id }, orderBy: { id: "asc" } })).toEqual(receiptsBefore);
    expect(await prisma.catalogInventoryItem.findMany({ where: { id: { in: [f.inventory.id, foreign.inventory.id] } }, orderBy: { id: "asc" } })).toEqual(inventoryBefore);
  });
  it("posts receipt and damage once, denies negative and foreign stock, and conserves projections", async () => {
    const f = await catalogFoundation(); const command = { type: "STOCK_RECEIPT" as const, quantityDelta: 5, locationPublicReference: f.location.publicReference, operationId: randomUUID(), reasonCode: "DISPOSABLE_RECEIPT", version: f.inventory.version };
    const receipt = await postCatalogInventoryMovement(f.store.id, f.user.id, f.inventory.publicReference, command);
    expect(await postCatalogInventoryMovement(f.store.id, f.user.id, f.inventory.publicReference, command)).toEqual(receipt);
    await postCatalogInventoryMovement(f.store.id, f.user.id, f.inventory.publicReference, { ...command, operationId: randomUUID(), version: 2, type: "DAMAGE", quantityDelta: -2 });
    const before = await prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { inventoryItemId_locationId: { inventoryItemId: f.inventory.id, locationId: f.location.id } } });
    expect(before).toMatchObject({ onHand: 3, reserved: 0, available: 3 }); const evidence = await catalogEvidence(f.inventory.publicReference);
    await expect(postCatalogInventoryMovement("foreign-store", f.user.id, f.inventory.publicReference, { ...command, version: 3, operationId: randomUUID() })).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    await expect(postCatalogInventoryMovement(f.store.id, f.user.id, f.inventory.publicReference, { ...command, quantityDelta: -4, type: "DAMAGE", version: 3, operationId: randomUUID() })).rejects.toThrow();
    await expect(postCatalogInventoryMovement(f.store.id, f.user.id, f.inventory.publicReference, { ...command, quantityDelta: 6 })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
    expect(await prisma.catalogInventoryLevel.findUnique({ where: { id: before.id } })).toEqual(before); expect(await catalogEvidence(f.inventory.publicReference)).toEqual(evidence);
    expect(await prisma.catalogInventoryMovement.count({ where: { inventoryItemId: f.inventory.id } })).toBe(2);
  });
  it("permits only one competing version to mutate stock and writes one coherent receipt", async () => {
    const f = await catalogFoundation(); const command = { type: "STOCK_RECEIPT" as const, quantityDelta: 1, locationPublicReference: f.location.publicReference, reasonCode: "DISPOSABLE_RACE", version: f.inventory.version };
    const results = await Promise.allSettled([1, 2].map(() => postCatalogInventoryMovement(f.store.id, f.user.id, f.inventory.publicReference, { ...command, operationId: randomUUID() })));
    expect(results.filter(item => item.status === "fulfilled")).toHaveLength(1); expect(results.filter(item => item.status === "rejected")).toHaveLength(1);
    expect(await prisma.catalogInventoryLevel.findFirst({ where: { inventoryItemId: f.inventory.id } })).toMatchObject({ onHand: 1, reserved: 0, available: 1 });
    expect(await prisma.catalogInventoryMovement.count({ where: { inventoryItemId: f.inventory.id } })).toBe(1);
    expect(await catalogEvidence(f.inventory.publicReference)).toMatchObject({ audit: [{ action: "STOCK_RECEIPT" }], events: [{ eventType: "INVENTORY_CHANGED" }] });
  });
});

