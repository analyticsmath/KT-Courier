import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";
import { upsertStorePickupAddress } from "@/lib/services/store-addresses.service";

describe("live merchant pickup changes revoke stale checkout readiness", () => {
  const ids: Record<string, string> = {};
  afterAll(async () => {
    if (!ids.store) return;
    await prisma.$transaction(async tx => {
      await tx.storefrontStoreDocument.deleteMany({ where: { storeId: ids.store } });
      await tx.adminActivityLog.deleteMany({ where: { entityType: "Store", entityId: ids.store } });
      await tx.store.update({ where: { id: ids.store }, data: { defaultPickupAddressId: null } });
      await tx.address.deleteMany({ where: { storeId: ids.store } });
      await tx.store.delete({ where: { id: ids.store } });
      await tx.user.delete({ where: { id: ids.user } });
    });
    await prisma.$disconnect();
  });
  it("recertifies moved pins but preserves live status on contact-only changes", async () => {
    requireDisposableStoreSettlementDatabase();
    const suffix = randomUUID();
    const user = await prisma.user.create({ data: { email: "pickup-change-" + suffix + "@example.test", role: "STORE", status: "ACTIVE" } });
    ids.user = user.id;
    const store = await prisma.store.create({ data: { ownerUserId: user.id, name: "Disposable pickup policy store", slug: "pickup-change-" + suffix, status: "ACTIVE", featured: true } });
    ids.store = store.id;
    const input = StorePickupAddressSchema.parse({
      line1: "10 Main Road", line2: "Central", city: "Johannesburg", province: "Gauteng",
      postalCode: "2001", country: "South Africa", latitude: -26.2041, longitude: 28.0473,
      placeId: "pickup_place_001", contactName: "First owner", contactPhone: "+27820000000",
    });
    const saved = await upsertStorePickupAddress(user.id, input);
    expect(saved?.line1).toBe("10 Main Road");
    expect(await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).toMatchObject({ status: "PENDING", featured: false });
    expect(await prisma.storefrontStoreDocument.findUniqueOrThrow({ where: { storeId: store.id } })).toMatchObject({ publicStatus: "INELIGIBLE" });

    // Simulate an administrator's later successful external route/checkout review.
    await prisma.store.update({ where: { id: store.id }, data: { status: "ACTIVE", featured: true } });
    await upsertStorePickupAddress(user.id, { ...input, contactName: "Updated owner", contactPhone: "+27820000011" });
    expect(await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).toMatchObject({ status: "ACTIVE", featured: true });

    await upsertStorePickupAddress(user.id, { ...input, line1: "12 Main Road", latitude: -26.2042, placeId: "pickup_place_002" });
    const after = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(after).toMatchObject({ status: "PENDING", featured: false });
    expect(await prisma.storefrontStoreDocument.findUniqueOrThrow({ where: { storeId: store.id } })).toMatchObject({ publicStatus: "INELIGIBLE" });
    const audit = await prisma.adminActivityLog.findFirstOrThrow({ where: { entityType: "Store", entityId: store.id }, orderBy: { createdAt: "desc" } });
    expect(audit.metadata).toMatchObject({ liveStatusRevoked: true, reason: "PICKUP_CHANGED_REQUIRES_ROUTE_AND_CHECKOUT_RECERTIFICATION" });
    expect(await prisma.address.count({ where: { storeId: store.id, type: "PICKUP", isDefault: true } })).toBe(1);
  });
});
