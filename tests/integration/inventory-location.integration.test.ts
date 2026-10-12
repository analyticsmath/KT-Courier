import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createStoreInventoryLocation, listStoreInventoryLocations } from "@/lib/services/catalog-inventory-location.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

async function store(status: "ACTIVE" | "PENDING" = "ACTIVE") {
  const tag = randomUUID();
  const owner = await prisma.user.create({ data: { email: `stock-owner-${tag}@example.test`, role: "STORE", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { name: "Synthetic new vendor", slug: `stock-${tag}`, ownerUserId: owner.id, status } });
  return { owner, store };
}

describe("stock location onboarding on disposable PostgreSQL", () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());

  it("commits one first location, receipt, audit and event under a concurrent retry", async () => {
    const source = await store(); const command = { name: "Vendor stockroom", operationId: randomUUID() };
    expect(await listStoreInventoryLocations(source.store.id)).toEqual([]);
    const results = await Promise.all([createStoreInventoryLocation(source.store.id, source.owner.id, command), createStoreInventoryLocation(source.store.id, source.owner.id, command)]);
    expect(results[0]).toEqual(results[1]); expect(results[0]).toMatchObject({ name: command.name, status: "ACTIVE", isPrimary: true, version: 1 });
    expect(await prisma.inventoryLocation.count({ where: { storeId: source.store.id } })).toBe(1);
    expect(await prisma.catalogOperationReceipt.count({ where: { storeId: source.store.id, operationId: command.operationId } })).toBe(1);
    expect(await prisma.catalogAuditHistory.count({ where: { aggregateReference: results[0].publicReference, action: "LOCATION_CREATED" } })).toBe(1);
    expect(await prisma.catalogChangeEvent.count({ where: { aggregateReference: results[0].publicReference } })).toBe(1);
    await expect(createStoreInventoryLocation(source.store.id, source.owner.id, { ...command, name: "Changed stockroom" })).rejects.toMatchObject({ code: "OPERATION_REPLAY_MISMATCH" });
  });

  it("rejects duplicate names without duplicating primary locations and isolates stores", async () => {
    const source = await store(); const foreign = await store();
    const created = await Promise.all(["Front stockroom", "Back stockroom"].map(name => createStoreInventoryLocation(source.store.id, source.owner.id, { name, operationId: randomUUID() })));
    expect(created.filter(location => location.isPrimary)).toHaveLength(1);
    await expect(createStoreInventoryLocation(source.store.id, source.owner.id, { name: "FRONT STOCKROOM", operationId: randomUUID() })).rejects.toMatchObject({ code: "INVENTORY_LOCATION_EXISTS" });
    expect(await listStoreInventoryLocations(foreign.store.id)).toEqual([]);
    expect((await createStoreInventoryLocation(foreign.store.id, foreign.owner.id, { name: "Front stockroom", operationId: randomUUID() })).isPrimary).toBe(true);
  });

  it("rejects pending stores and client-supplied ownership without persistent side effects", async () => {
    const source = await store("PENDING"); const command = { name: "Pending stockroom", operationId: randomUUID() };
    await expect(createStoreInventoryLocation(source.store.id, source.owner.id, command)).rejects.toMatchObject({ code: "CATALOG_OWNERSHIP_DENIED" });
    expect(await listStoreInventoryLocations(source.store.id)).toEqual([]);
    await expect(createStoreInventoryLocation(source.store.id, source.owner.id, { ...command, storeId: "foreign" } as typeof command)).rejects.toMatchObject({ code: "INVENTORY_LOCATION_INVALID" });
    expect(await prisma.catalogOperationReceipt.count({ where: { actorUserId: source.owner.id } })).toBe(0);
  });
});
