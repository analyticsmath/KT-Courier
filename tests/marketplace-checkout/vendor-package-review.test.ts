import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ settings: vi.fn(), declaration: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  marketplaceCheckout: { findUnique: async () => ({ reviewVersion: 1, lines: [{ reviewVersion: 1, offerReference: "offer", variantReference: "variant", publicationVersion: "1", quantity: 1, modifiers: [] }] }) },
  storeCatalogOffer: { findMany: async () => [{ publicReference: "offer", variant: { publicReference: "variant" }, version: 1 }] },
  systemSetting: { findMany: mocks.settings, findUnique: mocks.declaration },
} }));
vi.mock("@/lib/commercial/parcel-profiles", () => ({ publicParcelProfiles: async () => [
  { id: "small", stableKey: "SMALL", versionNumber: 1, lengthCm: 30, widthCm: 20, heightCm: 10, maximumWeightKg: 5 },
  { id: "medium", stableKey: "MEDIUM", versionNumber: 1, lengthCm: 50, widthCm: 40, heightCm: 30, maximumWeightKg: 15 },
  { id: "large", stableKey: "LARGE", versionNumber: 1, lengthCm: 70, widthCm: 50, heightCm: 50, maximumWeightKg: 30 },
] }));
import { classifyPersistedCheckoutParcel } from "@/lib/marketplace-checkout/parcel-configuration.service";
const version = { version: 1, status: "ACTIVE", effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: null, createdByUserId: "author", approvedByUserId: "reviewer", approvedAt: "2026-01-01T00:00:00Z", packages: [{ storeId: "store", offerReference: "offer", variantReference: "variant", publicationVersion: "1", modifiers: [], packingRule: "SINGLE_PREPACKAGED_UNIT", lengthCm: 20, widthCm: 15, heightCm: 5, weightKg: 1, authorityReference: "vendor_catalog_packaging:offer:reviewed-revision" }] };
beforeEach(() => { vi.clearAllMocks(); mocks.settings.mockImplementation(async () => [{ value: structuredClone(version), updatedAt: new Date() }]); });
it("uses independently approved measurements only while their vendor evidence is current", async () => { mocks.declaration.mockResolvedValue({ value: { revision: "reviewed-revision" } }); expect(await classifyPersistedCheckoutParcel("checkout", "store")).toMatchObject({ status: "CLASSIFIED", sizeClass: "SMALL" }); mocks.declaration.mockResolvedValue({ value: { revision: "updated-unreviewed-revision" } }); expect(await classifyPersistedCheckoutParcel("checkout", "store")).toMatchObject({ status: "UNKNOWN", reason: "TRUSTED_PACKAGE_SOURCE_MISSING" }); });
it("fails closed if reviewed vendor evidence disappears", async () => { mocks.declaration.mockResolvedValue(null); expect(await classifyPersistedCheckoutParcel("checkout", "store")).toMatchObject({ status: "UNKNOWN" }); });
