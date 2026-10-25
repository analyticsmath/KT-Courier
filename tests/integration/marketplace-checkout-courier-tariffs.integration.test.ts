import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { isSafeLocalTestDatabaseUrl } from "@/lib/testing/safe-postgres-validator";
import { createGate4ActiveProductScenario, createGate4Store } from "./gate4/fixtures";
import { activateOwnerSelectedCourierTariffs, MARKETPLACE_COURIER_TARIFF_POLICY_KEY } from "@/lib/marketplace-checkout/courier-tariff-policy";
import { actOnTrustedPackageVersion, listTrustedPackageVersions, saveTrustedPackageVersion } from "@/lib/marketplace-checkout/parcel-configuration.service";
import { createMarketplaceMatrixQuote } from "@/lib/marketplace-checkout/matrix-quote.service";
import { isFrozenCourierQuote } from "@/lib/marketplace-checkout/frozen-courier-quote";

// Only the independent road provider is substituted; all coverage, package,
// approval, catalog, checkout and quote records use real disposable PostgreSQL.
vi.mock("@/lib/maps/routes.service", () => ({ calculateRoute: async () => ({ ok: true, route: { distanceMeters: 25500, durationSeconds: 1200, provider: "DISPOSABLE_ROAD_PROVIDER", routeSummary: "Isolated provider fixture" } }) }));

describe("marketplace courier tariff persistence on isolated PostgreSQL", () => {
  it("audits activation, binds reviewed measured packaging and freezes the selected tariff", async () => {
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || !isSafeLocalTestDatabaseUrl(process.env.DATABASE_URL)) throw new Error("A disposable local test database is required.");
    const nonce = randomUUID();
    const actor = await prisma.user.create({ data: { email: `tariff-reviewer-${nonce}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
    const { store, ownerId } = await createGate4Store("tariffs", "quoted");
    const source = await createGate4ActiveProductScenario("tariffs", "quoted", store.id, { available: 5 });
    const region = await prisma.deliveryRegion.create({ data: { name: "Isolated road region", slug: `tariff-${nonce}`, province: "Gauteng", centerLat: -26.2, centerLng: 28.04, coverageRadiusKm: 200, maxDistanceKm: 200, displayOrder: -100 } });
    const activation = await activateOwnerSelectedCourierTariffs(actor.id);
    expect(activation.activated).toBe(true);
    expect(await activateOwnerSelectedCourierTariffs(actor.id)).toEqual({ activated: false });
    const policy = await prisma.systemSetting.findUniqueOrThrow({ where: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY } });
    expect(await prisma.adminActivityLog.count({ where: { entityId: policy.id, entityType: "MarketplaceCourierTariffPolicy" } })).toBe(1);
    const baseTariff = { baseFee: "89.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null };
    const service = await prisma.deliveryServiceDefinition.create({ data: { stableKey: "CLIENT_ECONOMY_PROOF", versionNumber: 1, displayName: "Isolated Economy", status: "ACTIVE", effectiveFrom: new Date("2026-01-01"), createdByUserId: actor.id, pricingPolicy: { stableKey: "CLIENT_ECONOMY_PROOF", displayName: "Isolated Economy", active: true, turnaround: "3–4 business days", provinces: ["Gauteng"], regionIds: [region.id], tariffs: { SMALL: baseTariff, MEDIUM: { ...baseTariff, baseFee: "129.00" }, LARGE: { ...baseTariff, baseFee: "179.00" } }, expectedVersion: 0, reason: "Disposable documented tariff proof" } } });
    for (const [index, stableKey] of ["SMALL", "MEDIUM", "LARGE"].entries()) await prisma.parcelProfileVersion.create({ data: { stableKey, versionNumber: 1, displayName: stableKey, status: "ACTIVE", effectiveFrom: new Date("2026-01-01"), lengthCm: [30, 50, 70][index], widthCm: [20, 40, 50][index], heightCm: [10, 30, 50][index], maximumWeightKg: [5, 15, 30][index], createdByUserId: actor.id } });
    await prisma.catalogPublicationSnapshot.create({ data: { publicReference: `tariff-publication-${nonce}`, productId: source.product.id, variantId: source.variant.id, offerId: source.offer.id, versionNumber: 1, publicationVersion: "proof-1", snapshot: {}, status: "PUBLISHED", createdByUserId: source.adminUser.id } });
    const cart = await prisma.marketplaceCart.create({ data: { publicReference: `tariff-cart-${nonce}`, ownerType: "GUEST", guestTokenHash: nonce } });
    const checkout = await prisma.marketplaceCheckout.create({ data: { publicReference: `tariff-checkout-${nonce}`, cartId: cart.id } });
    const group = await prisma.marketplaceCheckoutStoreGroup.create({ data: { checkoutId: checkout.id, storeId: store.id, fulfilmentMode: "COURIER_DELIVERY" } });
    const line = await prisma.marketplaceCheckoutLineSnapshot.create({ data: { checkoutId: checkout.id, storeGroupId: group.id, storeReference: store.id, productReference: source.product.publicReference, variantReference: source.variant.publicReference, offerReference: source.offer.publicReference, productTitle: "Disposable packaged product", variantTitle: "Default", quantity: 1, sellingUnit: "EACH", publicationVersion: String(source.offer.version), priceVersion: source.priceVersion.publicReference, baseUnitPrice: "90.00", modifierUnitTotal: "0.00", effectiveUnitPrice: "90.00", lineTotal: "90.00", taxTreatment: "DISPOSABLE" } });
    const input = { deliveryType: "PARCEL_DOCUMENT" as const, pickupAddress: { line1: "Disposable pickup", city: "Johannesburg", province: "Gauteng", country: "South Africa", latitude: -26.2, longitude: 28.04 }, dropoffAddress: { line1: "Disposable destination", city: "Pretoria", province: "Gauteng", country: "South Africa", latitude: -25.75, longitude: 28.19 } };
    const owner = { ownerType: "STORE" as const, ownerId, storeId: store.id };
    await expect(createMarketplaceMatrixQuote(owner, input, region.id, checkout.publicReference, service.stableKey)).rejects.toThrow("packed dimensions and weight must be verified");
    expect(await prisma.pricingQuote.count({ where: { storeId: store.id } })).toBe(0);
    const versions = await listTrustedPackageVersions();
    const draft = await saveTrustedPackageVersion(source.adminUser.id, { expectedVersion: Math.max(0, ...versions.map(version => version.version)), effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, reason: "Disposable measured package evidence only", packages: [{ storeId: store.id, offerReference: source.offer.publicReference, variantReference: source.variant.publicReference, publicationVersion: String(source.offer.version), modifiers: [], packingRule: "SINGLE_PREPACKAGED_UNIT", lengthCm: 20, widthCm: 15, heightCm: 8, weightKg: 4.5, authorityReference: "DISPOSABLE_MEASUREMENT_NOT_HUMAN_APPROVAL" }] });
    let packaging = (await listTrustedPackageVersions()).find(version => version.version === draft.version)!;
    await actOnTrustedPackageVersion(actor.id, { version: draft.version, expectedUpdatedAt: packaging.updatedAt, action: "APPROVE", reason: "Independent synthetic reviewer fixture" });
    packaging = (await listTrustedPackageVersions()).find(version => version.version === draft.version)!;
    await actOnTrustedPackageVersion(actor.id, { version: draft.version, expectedUpdatedAt: packaging.updatedAt, action: "ACTIVATE", reason: "Isolated reviewed package activation" });
    const result = await createMarketplaceMatrixQuote(owner, input, region.id, checkout.publicReference, service.stableKey);
    expect(result.total).toBe("89.00");
    const quote = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: result.id } });
    expect(quote.ruleSnapshot).toMatchObject({ serviceKey: service.stableKey, serviceVersion: 1, serviceDefinitionId: service.id, checkoutReference: checkout.publicReference, parcelClassification: { weightKg: 4.5, sizeClass: "SMALL" } });
    expect(isFrozenCourierQuote({ quote, storeId: store.id, reference: result.id, version: result.quoteVersion })).toBe(true);
    expect(isFrozenCourierQuote({ quote, storeId: store.id, reference: result.id, version: result.quoteVersion.replace(":1:", ":2:") })).toBe(false);
    await expect(prisma.marketplaceCheckoutLineSnapshot.update({ where: { id: line.id }, data: { quantity: 2 } })).rejects.toThrow("snapshot evidence is immutable");
    await prisma.marketplaceCheckout.update({ where: { id: checkout.id }, data: { reviewVersion: 2 } });
    await prisma.marketplaceCheckoutLineSnapshot.create({ data: { ...line, id: undefined, createdAt: undefined, reviewVersion: 2, quantity: 2, lineTotal: "180.00" } });
    await expect(createMarketplaceMatrixQuote(owner, input, region.id, checkout.publicReference, service.stableKey)).rejects.toThrow("packed dimensions and weight must be verified");
    expect(await prisma.pricingQuote.count({ where: { storeId: store.id } })).toBe(1);

    // The second approved snapshot measures the actual sealed two-unit parcel.
    // Its size is NOT inferred by doubling the first product's dimensions.
    const secondDraft = await saveTrustedPackageVersion(source.adminUser.id, {
      expectedVersion: draft.version, effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null,
      reason: "Isolated measured two-unit parcel with an independent reviewer",
      packages: [], bundles: [{ storeId: store.id, packingRule: "MEASURED_SEALED_CONSIGNMENT",
        lines: [{ offerReference: source.offer.publicReference, variantReference: source.variant.publicReference,
          publicationVersion: String(source.offer.version), quantity: 2, modifiers: [] }],
        lengthCm: 35, widthCm: 25, heightCm: 18, weightKg: 9,
        authorityReference: "ISOLATED_ACTUAL_SEALED_CONSIGNMENT_MEASUREMENT" }],
    });
    let second = (await listTrustedPackageVersions()).find(item => item.version === secondDraft.version)!;
    await actOnTrustedPackageVersion(actor.id, { version: second.version, expectedUpdatedAt: second.updatedAt,
      action: "APPROVE", reason: "Separate reviewer for isolated package evidence" });
    second = (await listTrustedPackageVersions()).find(item => item.version === secondDraft.version)!;
    await actOnTrustedPackageVersion(actor.id, { version: second.version, expectedUpdatedAt: second.updatedAt,
      action: "ACTIVATE", reason: "Activate independently reviewed two-unit consignment" });
    const aggregate = await createMarketplaceMatrixQuote(owner, input, region.id, checkout.publicReference, service.stableKey);
    expect(aggregate.total).toBe("89.00");
    const aggregateRow = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: aggregate.id } });
    expect(aggregateRow.ruleSnapshot).toMatchObject({ parcelClassification: {
      reason: "REVIEWED_MEASURED_CONSIGNMENT", sizeClass: "MEDIUM", weightKg: 9, packageVersion: second.version,
    } });
    expect(isFrozenCourierQuote({ quote: aggregateRow, storeId: store.id, reference: aggregate.id, version: aggregate.quoteVersion })).toBe(true);

    // An altered customer quantity never matches the sealed measurements.
    await prisma.marketplaceCheckout.update({ where: { id: checkout.id }, data: { reviewVersion: 3 } });
    await prisma.marketplaceCheckoutLineSnapshot.create({ data: { ...line, id: undefined, createdAt: undefined,
      reviewVersion: 3, quantity: 3, lineTotal: "270.00" } });
    await expect(createMarketplaceMatrixQuote(owner, input, region.id, checkout.publicReference, service.stableKey)).rejects.toThrow("packed dimensions and weight must be verified");
    expect(await prisma.pricingQuote.count({ where: { storeId: store.id } })).toBe(2);
  }, 90_000);
});
