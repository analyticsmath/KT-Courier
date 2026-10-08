import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { postCatalogInventoryMovement } from "@/lib/services/catalog-inventory.service";
import { describeCatalogIntegration } from "./catalog-integration-guard";
import { catalogFoundation, catalogEvidence } from "./catalog-canonical-support";

describeCatalogIntegration("canonical catalog inventory", () => {
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

