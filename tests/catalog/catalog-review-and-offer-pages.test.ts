import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  product: vi.fn(), asset: vi.fn(), offer: vi.fn(), locations: vi.fn(),
  permission: vi.fn().mockResolvedValue(true),
  storePermission: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("Not found"); }, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/auth/guards", () => ({ requireAdminPagePermission: vi.fn().mockResolvedValue({ id: "admin", role: "ADMIN" }) }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: f.permission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { catalogProduct: { findUnique: f.product }, inventoryLocation: { findMany: f.locations } } }));
vi.mock("@/lib/services/catalog-media-page.service", () => ({ getAdminCatalogMediaForPage: f.asset }));
vi.mock("@/lib/client-platform/business-auth", () => ({ requireBusinessPage: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/services/catalog-page.service", () => ({ getCurrentStoreForCatalogPage: vi.fn().mockResolvedValue({ store: { id: "store" }, user: { id: "owner" } }) }));
vi.mock("@/lib/services/store-offer.service", () => ({ getStoreCatalogOffer: f.offer }));
vi.mock("@/lib/catalog/catalog-auth", () => ({ storeCatalogPermission: f.storePermission }));

import ProductPage from "@/app/(admin)/admin/catalog/products/[id]/page";
import MediaPage from "@/app/(admin)/admin/catalog/media/[id]/page";
import OfferPage from "@/app/(store)/store/catalog/offers/[publicReference]/page";

const image = { id: "asset-1", publicReference: "CMA-public", status: "READY", privacyInspectionPassed: true, mimeType: "image/png", byteSize: 123, width: 600, height: 600, checksum: "checksum" };
const price = { id: "price", publicReference: "CPR-price", amount: { toFixed: () => "25.00" }, currency: "ZAR", status: "DRAFT", effectiveFrom: new Date("2026-10-14T00:00:00Z"), effectiveUntil: null };
const offer = () => ({
  id: "offer", publicReference: "CO-offer", storeSku: "SKU", version: 3, status: "NEEDS_CHANGES", publicationStatus: "UNPUBLISHED",
  product: { title: "Product" }, variant: { title: "Default" }, fulfilmentMode: "COURIER_DELIVERY", minimumQuantity: 1,
  merchantTitle: "Store title", merchantDescription: "Store description", primaryInventoryLocationId: null, priceVersions: [price], inventoryItem: null,
});

describe("catalog review and correction pages", () => {
  it("lets an administrator inspect an unpublished product image privately", async () => {
    f.product.mockResolvedValue({
      id: "product", title: "Product", publicReference: "CP-product", sourceStore: { name: "Store" }, primaryCategory: { path: "goods" },
      productTypeDefinition: { code: "GOODS" }, productTypeVersionNumber: 1, status: "SUBMITTED", moderationStatus: "PENDING", publicationStatus: "UNPUBLISHED",
      updatedAt: new Date(), condition: "NEW", version: 1, offers: [], variants: [], moderationCases: [],
      media: [{ id: "link", role: "PRIMARY", variantId: null, altText: "A product", asset: image }],
    });
    const html = renderToStaticMarkup(await ProductPage({ params: Promise.resolve({ id: "product" }) }));
    expect(html).toContain('src="/api/admin/catalog/media/asset-1/content"');
    expect(html).toContain('href="/api/admin/catalog/media/asset-1/content?download=1"');
    expect(html).not.toContain('/api/catalog/media/CMA-public');
  });

  it("shows private image inspection on the dedicated moderation page", async () => {
    f.asset.mockResolvedValue({ ...image, purpose: "PRODUCT_IMAGE", ownerType: "STORE", ownerStore: { name: "Store" }, productMedia: [], history: [], declaredMimeType: "image/png", declaredByteSize: 123 });
    const html = renderToStaticMarkup(await MediaPage({ params: Promise.resolve({ id: "asset-1" }) }));
    expect(html).toContain('src="/api/admin/catalog/media/asset-1/content"');
  });

  it("exposes offer correction and exact VAT-inclusive draft pricing to permitted vendors", async () => {
    f.offer.mockResolvedValue(offer()); f.locations.mockResolvedValue([]);
    const html = renderToStaticMarkup(await OfferPage({ params: Promise.resolve({ publicReference: "CO-offer" }) }));
    expect(html).toContain("Save offer changes");
    expect(html).toContain("Create reviewed-price draft");
    expect(html).toContain("Price including VAT (ZAR)");
  });

  it("keeps price and offer editors off active records and denied accounts", async () => {
    f.offer.mockResolvedValue({ ...offer(), status: "ACTIVE" }); f.locations.mockResolvedValue([]);
    let html = renderToStaticMarkup(await OfferPage({ params: Promise.resolve({ publicReference: "CO-offer" }) }));
    expect(html).not.toContain("Save offer changes");
    expect(html).not.toContain("Create reviewed-price draft");
    f.offer.mockResolvedValue(offer()); f.storePermission.mockResolvedValue({ allowed: false });
    html = renderToStaticMarkup(await OfferPage({ params: Promise.resolve({ publicReference: "CO-offer" }) }));
    expect(html).not.toContain("Save offer changes");
    expect(html).not.toContain("Create reviewed-price draft");
    f.storePermission.mockResolvedValue({ allowed: true });
  });
});
