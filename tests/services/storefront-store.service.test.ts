import { expect, test, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ storeFindUnique: vi.fn(), queryRaw: vi.fn(), storeUpsert: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ store: { findUnique: dependencies.storeFindUnique }, $queryRaw: dependencies.queryRaw, storefrontStoreDocument: { upsert: dependencies.storeUpsert } }), store: { findUnique: dependencies.storeFindUnique }, $queryRaw: dependencies.queryRaw, storefrontStoreDocument: { upsert: dependencies.storeUpsert } } }));
import { rebuildStorefrontStoreDocument } from "@/lib/services/storefront-store.service";

const pickup = {
  id: "pickup", storeId: "store", type: "PICKUP", isDefault: true,
  line1: "10 Main Road", line2: "Sandton", city: "Johannesburg",
  province: "Gauteng", country: "South Africa", postalCode: "2196",
  latitude: -26.1, longitude: 28.05,
};

test("store service publishes a privacy-minimised projection only with a complete saved pickup", async () => {
  dependencies.storeFindUnique.mockResolvedValue({ id: "store", slug: "tea-store", name: "Tea Store", status: "ACTIVE", updatedAt: new Date(), defaultPickupAddress: pickup, savedAddresses: [pickup] });
  dependencies.queryRaw.mockResolvedValue([{ categoryPublicReference: "CC-1", fulfilmentMode: "COURIER_DELIVERY" }]);
  await rebuildStorefrontStoreDocument("store");
  const create = dependencies.storeUpsert.mock.calls[0][0].create;
  expect(create).toMatchObject({ publicStatus: "ACTIVE", publishedOfferCount: 1 });
  expect(JSON.stringify(create)).not.toMatch(/address|phone|email/i);
});

test("store service keeps a store with no saved pickup out of the public storefront", async () => {
  dependencies.storeFindUnique.mockResolvedValue({ id: "store", slug: "tea-store", name: "Tea Store", status: "ACTIVE", updatedAt: new Date(), defaultPickupAddress: null, savedAddresses: [] });
  dependencies.queryRaw.mockResolvedValue([{ categoryPublicReference: "CC-1", fulfilmentMode: "COURIER_DELIVERY" }]);
  dependencies.storeUpsert.mockClear();
  await rebuildStorefrontStoreDocument("store");
  expect(dependencies.storeUpsert.mock.calls[0][0].create).toMatchObject({ publicStatus: "INELIGIBLE", publishedOfferCount: 1 });
});
