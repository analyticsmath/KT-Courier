import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), snapshot: vi.fn(), project: vi.fn(), evidence: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/catalog/catalog-production-lock", () => ({ assertCatalogProductionActivationAllowed: vi.fn() }));
vi.mock("@/lib/services/catalog-service-support", () => ({ recordCatalogEvidence: mocks.evidence }));
vi.mock("@/lib/services/catalog-publication.service", () => ({ rebuildCatalogPublicationSnapshot: mocks.snapshot }));
vi.mock("@/lib/services/storefront-projection.service", () => ({ StorefrontProjectionService: class { buildPublishedSnapshot = mocks.project; } }));
vi.mock("@/lib/services/storefront-store.service", () => ({ rebuildStorefrontStoreDocument: vi.fn() }));
vi.mock("@/lib/services/storefront-category.service", () => ({ rebuildStorefrontCategoryDocument: vi.fn() }));
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";

const input = { version: 4, productVersion: 5, priceVersionReference: "price-reviewed", operationId: "republish-operation", reasonCode: "PRODUCT_REVIEWED" };
let offer: ReturnType<typeof buildOffer>;
let price: ReturnType<typeof buildPrice>;
let tx: ReturnType<typeof buildTransaction>;
beforeEach(() => {
  vi.clearAllMocks();
  offer = buildOffer();
  price = buildPrice();
  tx = buildTransaction();
  mocks.transaction.mockImplementation(async work => work(tx));
  mocks.snapshot.mockResolvedValue({ publicReference: "new-snapshot", publicationVersion: "v2", status: "PUBLISHED" });
});

it("republishes reviewed corrections with a fresh snapshot and no price reactivation", async () => {
  const result = await publishApprovedCatalogListing("offer", "publisher", input);
  expect(result.snapshot.publicReference).toBe("new-snapshot");
  expect(mocks.project).toHaveBeenCalledWith("new-snapshot");
  expect(tx.storeOfferPriceVersion.updateMany).not.toHaveBeenCalled();
  expect(tx.storeOfferPriceVersion.update).not.toHaveBeenCalled();
  expect(tx.catalogProduct.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) }));
});

it.each(["unreviewed", "stale-price", "suspended", "expired-price", "self-review", "stale-version"])("refuses republication with %s evidence", async fault => {
  if (fault === "unreviewed") offer.product.moderationStatus = "PENDING";
  if (fault === "stale-price") offer.currentPriceVersionId = "another-price";
  if (fault === "suspended") offer.status = "SUSPENDED";
  if (fault === "expired-price") price.effectiveUntil = new Date(0);
  if (fault === "self-review") offer.store.ownerUserId = "publisher";
  if (fault === "stale-version") offer.product.version++;
  await expect(publishApprovedCatalogListing("offer", "publisher", input)).rejects.toThrow();
  expect(tx.storeCatalogOffer.update).not.toHaveBeenCalled();
  expect(mocks.project).not.toHaveBeenCalled();
});

it("retains the first-publication draft price and variant path", async () => {
  offer.status = "SUBMITTED"; offer.publicationStatus = "UNPUBLISHED"; offer.variant.status = "DRAFT"; price.status = "DRAFT";
  await publishApprovedCatalogListing("offer", "publisher", input);
  expect(tx.storeOfferPriceVersion.update).toHaveBeenCalledOnce();
  expect(mocks.project).toHaveBeenCalledWith("new-snapshot");
});
function buildOffer() { return { id: "offer", publicReference: "offer-reference", version: 4, status: "ACTIVE", publicationStatus: "PUBLISHED", currentPriceVersionId: "price", approvedByUserId: "reviewer", storeId: "store", productId: "product", variantId: "variant", store: { status: "ACTIVE", ownerUserId: "vendor" }, createdByUserId: "vendor", submittedByUserId: "vendor", variant: { status: "ACTIVE" }, product: { version: 5, status: "APPROVED", moderationStatus: "APPROVED", approvedByUserId: "reviewer", scope: "STORE_PRIVATE", sourceStoreId: "store", createdByUserId: "vendor", submittedByUserId: "vendor", primaryCategoryId: "category", primaryCategory: { status: "ACTIVE" }, productTypeDefinition: { status: "ACTIVE" }, media: [{ role: "PRIMARY", variantId: null, asset: { status: "READY", privacyInspectionPassed: true, storageConfirmedAt: new Date(), validatedAt: new Date() } }] } }; }
function buildPrice() { return { id: "price", publicReference: "price-reviewed", status: "ACTIVE", effectiveFrom: new Date(0), effectiveUntil: null as Date | null, createdByUserId: "vendor", versionNumber: 1 }; }
function buildTransaction() { return { $queryRaw: vi.fn(), user: { findUnique: vi.fn().mockResolvedValue({ role: "SUPER_ADMIN", status: "ACTIVE" }) }, catalogOperationReceipt: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, storeCatalogOffer: { findUnique: vi.fn().mockImplementation(async () => offer), findUniqueOrThrow: vi.fn().mockImplementation(async () => offer), update: vi.fn().mockResolvedValue({ status: "ACTIVE", publicationStatus: "PUBLISHED", version: 5 }) }, storeOfferPriceVersion: { findFirst: vi.fn().mockImplementation(async () => price), updateMany: vi.fn(), update: vi.fn() }, catalogProduct: { update: vi.fn() }, catalogProductVariant: { update: vi.fn() } }; }
