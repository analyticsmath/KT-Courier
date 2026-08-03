import { describe, expect, it } from "vitest";
import { assertCatalogMediaOwnerShape, assertCatalogMediaOwnershipImmutable, assertStoreCanAccessCatalogMedia } from "@/lib/catalog/media/catalog-media-ownership";

describe("catalog media ownership", () => {
  it("requires coherent platform and store ownership", () => { expect(() => assertCatalogMediaOwnerShape({ ownerType: "PLATFORM", ownerStoreId: null })).not.toThrow(); expect(() => assertCatalogMediaOwnerShape({ ownerType: "STORE", ownerStoreId: "store-a" })).not.toThrow(); expect(() => assertCatalogMediaOwnerShape({ ownerType: "PLATFORM", ownerStoreId: "store-a" })).toThrow(); });
  it("denies cross-store access and immutable owner changes", () => { expect(() => assertStoreCanAccessCatalogMedia({ ownerType: "STORE", ownerStoreId: "store-a" }, "store-b")).toThrow(); expect(() => assertCatalogMediaOwnershipImmutable({ ownerType: "STORE", ownerStoreId: "store-a" }, { ownerType: "PLATFORM", ownerStoreId: null }, { ready: true, attached: false })).toThrow(); });
});
