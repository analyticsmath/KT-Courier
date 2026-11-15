import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  certFindFirst: vi.fn(),
  certUpdateMany: vi.fn(),
  offerFindMany: vi.fn(),
  storeUpdate: vi.fn(),
  storeDocUpdateMany: vi.fn(),
  rebuild: vi.fn(),
}));

vi.mock("@/lib/services/storefront-store.service", () => ({
  rebuildStorefrontStoreDocument: mocks.rebuild,
}));

import { syncStoreReadinessAfterCatalogOfferChange } from "@/lib/admin/store-readiness-sync";

function makeTx() {
  return {
    storeCheckoutCertification: {
      findFirst: mocks.certFindFirst,
      updateMany: mocks.certUpdateMany,
    },
    storeCatalogOffer: {
      findMany: mocks.offerFindMany,
    },
    store: {
      findUnique: vi.fn(),
      update: mocks.storeUpdate,
    },
    storefrontStoreDocument: {
      updateMany: mocks.storeDocUpdateMany,
    },
  } as never;
}

describe("syncStoreReadinessAfterCatalogOfferChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.certFindFirst.mockResolvedValue({
      proofOfferReference: "CO-PROOF",
      proofPriceVersionReference: "PRICE-PROOF",
    });
    mocks.certUpdateMany.mockResolvedValue({ count: 1 });
    mocks.storeUpdate.mockResolvedValue({ commerceReadinessRevision: 2 });
    mocks.storeDocUpdateMany.mockResolvedValue({ count: 1 });
    mocks.rebuild.mockResolvedValue(undefined);
  });

  it("keeps live certification and rebuilds storefront when a secondary offer changes and proof offer stays sellable", async () => {
    mocks.offerFindMany.mockResolvedValue([
      {
        id: "offer-proof",
        minimumQuantity: 1,
        inventoryTrackingMode: "TRACKED",
        inventoryItem: { allowBackorder: false, levels: [{ available: 5 }] },
      },
    ]);

    await syncStoreReadinessAfterCatalogOfferChange(makeTx(), "store-1", ["CO-SECOND"]);

    expect(mocks.storeUpdate).not.toHaveBeenCalled();
    expect(mocks.certUpdateMany).not.toHaveBeenCalled();
    expect(mocks.rebuild).toHaveBeenCalledTimes(1);
    expect(mocks.rebuild).toHaveBeenCalledWith("store-1", expect.anything());
  });

  it("invalidates checkout readiness when the certified proof offer is modified", async () => {
    mocks.offerFindMany.mockResolvedValue([
      {
        id: "offer-second",
        minimumQuantity: 1,
        inventoryTrackingMode: "UNTRACKED",
        inventoryItem: null,
      },
    ]);

    await syncStoreReadinessAfterCatalogOfferChange(makeTx(), "store-1", ["CO-PROOF"]);

    expect(mocks.storeUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.rebuild).toHaveBeenCalledTimes(1);
    expect(mocks.rebuild).toHaveBeenCalledWith("store-1", expect.anything());
  });

  it("invalidates checkout readiness when no sellable offers remain above minimumQuantity", async () => {
    mocks.offerFindMany.mockResolvedValue([
      {
        id: "offer-other",
        minimumQuantity: 3,
        inventoryTrackingMode: "TRACKED",
        inventoryItem: { allowBackorder: false, levels: [{ available: 2 }] },
      },
    ]);

    await syncStoreReadinessAfterCatalogOfferChange(makeTx(), "store-1", ["CO-SECOND"]);

    expect(mocks.storeUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.rebuild).toHaveBeenCalledTimes(1);
    expect(mocks.rebuild).toHaveBeenCalledWith("store-1", expect.anything());
  });
});
