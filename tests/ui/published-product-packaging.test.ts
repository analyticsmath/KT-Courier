import { isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn() }));
vi.mock("@/lib/client-platform/business-auth", () => ({ requireBusinessPage: async () => {} }));
vi.mock("@/lib/services/catalog-page.service", () => ({ getCurrentStoreForCatalogPage: async () => ({ store: { id: "store" } }) }));
vi.mock("@/lib/services/catalog-product.service", () => ({ getStoreCatalogProduct: async () => ({ publicReference: "CP-published", sourceStoreId: "store", scope: "STORE_PRIVATE", title: "Published apples", status: "ACTIVE", moderationStatus: "APPROVED", publicationStatus: "PUBLISHED", primaryCategory: { path: "/groceries" }, variants: [], offers: [{ publicReference: "CO-apples", storeSku: "APPLES" }], brand: null }) }));
vi.mock("@/lib/services/catalog-packaging.service", () => ({ listCatalogPackaging: async () => [] }));
vi.mock("@/lib/commercial/parcel-profiles", () => ({ publicParcelProfiles: async () => [] }));
vi.mock("@/lib/catalog/catalog-auth", () => ({ requireStoreCatalogPermission: mocks.permission }));
import Page from "@/app/(store)/store/catalog/products/[publicReference]/page";
import { StorePackagingManager } from "@/components/catalog/StorePackagingManager";
import { StoreCatalogProductActions } from "@/components/catalog/StoreCatalogProductActions";
function includes(node: ReactNode, type: unknown): boolean {
  if (Array.isArray(node)) return node.some(child => includes(child, type));
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;
  return node.type === type || includes(node.props.children, type);
}
beforeEach(() => mocks.permission.mockReset());
it("offers packaging submission on an already published product without opening draft editing", async () => { mocks.permission.mockResolvedValue({ store: { id: "store" }, user: { id: "owner" } }); const page = await Page({ params: Promise.resolve({ publicReference: "CP-published" }) }); expect(includes(page, StorePackagingManager)).toBe(true); expect(includes(page, StoreCatalogProductActions)).toBe(false); expect(mocks.permission).toHaveBeenCalledTimes(1); });
it("keeps packaging controls hidden when catalog management is denied", async () => { mocks.permission.mockResolvedValue({ response: { status: 403 } }); const page = await Page({ params: Promise.resolve({ publicReference: "CP-published" }) }); expect(includes(page, StorePackagingManager)).toBe(false); });
