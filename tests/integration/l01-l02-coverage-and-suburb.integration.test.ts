import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mapMocks = vi.hoisted(() => ({
  pickupLat: -26.1467,
  pickupLng: 28.0416,
  dropoffLat: -25.7479,
  dropoffLng: 28.2293,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "a".repeat(64) }),
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/maps/geocode.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maps/geocode.service")>();
  return {
    ...actual,
    geocodeSouthAfricanAddress: vi.fn(async (addr: { city?: string | null; province?: string | null }) => {
      if (addr.province === "Western Cape") {
        return { latitude: -33.9249, longitude: 18.4241 };
      }
      if ((addr.city ?? "").toLowerCase().includes("pretoria")) {
        return { latitude: mapMocks.dropoffLat, longitude: mapMocks.dropoffLng };
      }
      return { latitude: mapMocks.pickupLat, longitude: mapMocks.pickupLng };
    }),
    reverseGeocodeSouthAfricanProvince: vi.fn(async (lat: number) => (lat < -30 ? "Western Cape" : "Gauteng") as "Western Cape" | "Gauteng"),
  };
});

vi.mock("@/lib/maps/routes.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maps/routes.service")>();
  return {
    ...actual,
    calculateRoute: vi.fn(async () => ({
      ok: true as const,
      route: {
        distanceMeters: 52000,
        durationSeconds: 2700,
        routeSummary: "52.0 km · ~45 min",
        provider: "e2e_deterministic",
      },
    })),
  };
});

import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import {
  createCustomerAddress,
  getCustomerAddress,
  updateCustomerAddress,
} from "@/lib/services/customer-addresses.service";
import { SavedAddressCreateSchema, SavedAddressUpdateSchema } from "@/lib/validation/address-book";
import { customerCheckoutAddressPrefill } from "@/lib/marketplace-checkout/customer-checkout-prefill";
import { updateMarketplaceCheckoutAddress } from "@/lib/marketplace-checkout/checkout.service";
import { createPublicQuote, saveDeliveryConfiguration } from "@/lib/client-platform/delivery.service";
import { calculateRoute } from "@/lib/maps/routes.service";
import { evaluateLocalityCashRisk, parseHighRiskAreas } from "@/lib/settings/high-risk-area-policy";
import { updateSettingValue } from "@/lib/services/admin-settings.service";
import { setDeliveryRegionHighRisk } from "@/lib/settings/high-risk-region-policy";
import { DeliveryConfigurationSchema, type PublicQuoteInput } from "@/lib/client-platform/contracts";

const tag = randomUUID().slice(0, 8);
const cleanupUserIds: string[] = [];
const cleanupCartIds: string[] = [];
const cleanupCheckoutIds: string[] = [];
const cleanupRegionIds: string[] = [];
const cleanupServiceIds: string[] = [];
const cleanupServiceKeys: string[] = [];
const suspendedUnconfiguredServiceIds: string[] = [];
let adminId = "";
let previousHighRiskAreas: unknown = null;

describe("L-01 saved address suburb isolation and L-02 Gauteng/Pretoria/high-risk coverage in PostgreSQL", () => {
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const admin = await prisma.user.create({
      data: { email: `l01l02-admin-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    adminId = admin.id;
    cleanupUserIds.push(admin.id);

    const existingAreas = await prisma.systemSetting.findUnique({ where: { key: "delivery.high_risk_areas" } });
    previousHighRiskAreas = existingAreas?.value ?? null;

    // Suspend any pre-existing unconfigured ACTIVE CLIENT_* test fixtures (e.g. CLIENT_CLOSURE with null pricingPolicy)
    // left in shared disposable PostgreSQL by prior test suites so deliveryCatalog() stays fail-closed without colliding.
    const existingClientServices = await prisma.deliveryServiceDefinition.findMany({
      where: { stableKey: { startsWith: "CLIENT_" }, status: "ACTIVE" },
      select: { id: true, pricingPolicy: true },
    });
    const invalidServiceIds = existingClientServices
      .filter((row) => !DeliveryConfigurationSchema.safeParse(row.pricingPolicy).success)
      .map((row) => row.id);
    if (invalidServiceIds.length > 0) {
      await prisma.deliveryServiceDefinition.updateMany({
        where: { id: { in: invalidServiceIds } },
        data: { status: "RETIRED" },
      });
      suspendedUnconfiguredServiceIds.push(...invalidServiceIds);
    }

    // Ensure SMALL parcel profile is active in clean DB
    await prisma.parcelProfileVersion.upsert({
      where: { stableKey_versionNumber: { stableKey: "SMALL", versionNumber: 1 } },
      create: {
        stableKey: "SMALL",
        versionNumber: 1,
        displayName: "Small",
        lengthCm: 30,
        widthCm: 20,
        heightCm: 10,
        maximumWeightKg: new Prisma.Decimal("5"),
        status: "ACTIVE",
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: admin.id,
      },
      update: { status: "ACTIVE" },
    });
  });

  afterAll(async () => {
    try {
      if (suspendedUnconfiguredServiceIds.length) {
        await prisma.deliveryServiceDefinition.updateMany({
          where: { id: { in: suspendedUnconfiguredServiceIds } },
          data: { status: "ACTIVE" },
        });
      }
      if (previousHighRiskAreas !== null) {
        await prisma.systemSetting.updateMany({
          where: { key: "delivery.high_risk_areas" },
          data: { value: previousHighRiskAreas as Prisma.InputJsonValue },
        });
      }
      if (cleanupCheckoutIds.length) {
        await prisma.marketplaceCheckout.deleteMany({ where: { id: { in: cleanupCheckoutIds } } });
      }
      if (cleanupCartIds.length) {
        await prisma.marketplaceCart.deleteMany({ where: { id: { in: cleanupCartIds } } });
      }
      if (cleanupServiceIds.length || cleanupServiceKeys.length) {
        await prisma.deliveryServiceDefinition.deleteMany({
          where: {
            OR: [
              ...(cleanupServiceIds.length ? [{ id: { in: cleanupServiceIds } }] : []),
              ...(cleanupServiceKeys.length ? [{ stableKey: { in: cleanupServiceKeys } }] : []),
            ],
          },
        });
      }
      if (cleanupRegionIds.length) {
        await prisma.deliveryRegion.deleteMany({ where: { id: { in: cleanupRegionIds } } });
      }
      if (cleanupUserIds.length) {
        await prisma.address.deleteMany({ where: { userId: { in: cleanupUserIds } } });
        await prisma.adminActivityLog.deleteMany({ where: { actorUserId: { in: cleanupUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("L-01: persists unit line2 and suburb independently, resets map pin on suburb change, denies foreign owners, and stores snapshot cleanly", async () => {
    const owner = await prisma.user.create({
      data: { email: `l01-owner-${tag}@example.test`, role: "CUSTOMER", status: "ACTIVE" },
    });
    const outsider = await prisma.user.create({
      data: { email: `l01-outsider-${tag}@example.test`, role: "CUSTOMER", status: "ACTIVE" },
    });
    cleanupUserIds.push(owner.id, outsider.id);

    // 1. Save address with distinct unit line2 and suburb + map coordinates
    const created = await createCustomerAddress(
      owner.id,
      SavedAddressCreateSchema.parse({
        type: "CUSTOMER",
        label: "Home",
        isDefault: true,
        line1: "12 Oxford Rd",
        line2: "Unit 4B",
        suburb: "Rosebank",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2196",
        country: "South Africa",
        formattedAddress: "12 Oxford Rd, Rosebank, Johannesburg, Gauteng, 2196, South Africa",
        placeId: "ChIJrosebank01",
        latitude: -26.1467,
        longitude: 28.0416,
      }),
    );
    expect(created).toMatchObject({
      line2: "Unit 4B",
      suburb: "Rosebank",
      placeId: "ChIJrosebank01",
      latitude: -26.1467,
      longitude: 28.0416,
    });

    // Prefill retains independent line2 and suburb
    const prefill = customerCheckoutAddressPrefill(created);
    expect(prefill).toMatchObject({
      line2: "Unit 4B",
      suburb: "Rosebank",
      needsSuburbConfirmation: false,
      needsMapLocationConfirmation: false,
    });

    // 2. Changing suburb without a new map pin invalidates stale placeId/coordinates while leaving line2 intact
    const updated = await updateCustomerAddress(
      owner.id,
      created.id,
      SavedAddressUpdateSchema.parse({ suburb: "Sandton" }),
    );
    expect(updated).toMatchObject({
      line2: "Unit 4B",
      suburb: "Sandton",
      placeId: null,
      latitude: null,
      longitude: null,
    });

    // 3. Historic saved address lacking suburb/coords never promotes line2 into suburb
    const legacy = await createCustomerAddress(
      owner.id,
      SavedAddressCreateSchema.parse({
        type: "DROPOFF",
        line1: "45 Commissioner St",
        line2: "Unit 4B",
        city: "Johannesburg",
        province: "Gauteng",
      }),
    );
    expect(legacy.suburb).toBeNull();
    expect(customerCheckoutAddressPrefill(legacy)).toMatchObject({
      line2: "Unit 4B",
      suburb: "",
      needsSuburbConfirmation: true,
      needsMapLocationConfirmation: true,
      mapped: null,
    });

    // 4. Foreign customer cannot read or mutate saved addresses
    expect(await getCustomerAddress(outsider.id, created.id)).toBeNull();
    expect(await updateCustomerAddress(outsider.id, created.id, SavedAddressUpdateSchema.parse({ suburb: "Hillbrow" }))).toBeNull();

    // 5. Checkout address update commits snapshot preserving independent line2 and suburb & denies foreign owner
    const cart = await prisma.marketplaceCart.create({
      data: { publicReference: `cart-${tag}`, ownerType: "CUSTOMER", customerUserId: owner.id, status: "ACTIVE" },
    });
    cleanupCartIds.push(cart.id);
    const checkout = await prisma.marketplaceCheckout.create({
      data: {
        publicReference: `chk-${tag}`,
        cartId: cart.id,
        customerUserId: owner.id,
        status: "CREATED",
        merchandiseSubtotal: 100,
        grandTotal: 100,
      },
    });
    cleanupCheckoutIds.push(checkout.id);
    const gautengRegion = await prisma.deliveryRegion.create({
      data: {
        name: `L01 Gauteng ${tag}`,
        slug: `l01-gauteng-${tag}`,
        coverageMode: "PROVINCE",
        province: "Gauteng",
        active: true,
        pricingEnabled: true,
      },
    });
    cleanupRegionIds.push(gautengRegion.id);

    const requestHash = createHash("sha256").update(`req-${tag}`).digest("hex");
    await expect(
      updateMarketplaceCheckoutAddress({
        reference: checkout.publicReference,
        owner: { type: "CUSTOMER", userId: outsider.id },
        operation: { operationId: `op-foreign-${tag}`, requestHash, expectedVersion: checkout.version },
        address: { recipientName: "Intruder", line1: "12 Oxford Rd", line2: "Unit 4B", suburb: "Rosebank", city: "Johannesburg", province: "Gauteng" },
      }),
    ).rejects.toMatchObject({ code: "CHECKOUT_ACCESS_DENIED" });

    const savedSnapshot = await updateMarketplaceCheckoutAddress({
      reference: checkout.publicReference,
      owner: { type: "CUSTOMER", userId: owner.id },
      operation: { operationId: `op-owner-${tag}`, requestHash, expectedVersion: checkout.version },
      address: {
        recipientName: "Owner Name",
        line1: "12 Oxford Rd",
        line2: "Unit 4B",
        suburb: "Rosebank",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2196",
        placeId: "ChIJrosebank01",
        latitude: -26.1467,
        longitude: 28.0416,
      },
    });
    expect(savedSnapshot.checkout.deliveryAddress).toMatchObject({
      line1: "12 Oxford Rd",
      line2: "Unit 4B",
      suburb: "Rosebank",
      city: "Johannesburg",
    });
  });

  it("L-02: enforces Johannesburg/Pretoria/Gauteng coverage, inactive services, outside provinces, and editable high-risk cash areas", async () => {
    const jhbRegion = await prisma.deliveryRegion.create({
      data: {
        name: `Jhb Zone ${tag}`,
        slug: `l02-jhb-${tag}`,
        coverageMode: "RADIUS",
        city: "Johannesburg",
        province: "Gauteng",
        centerLat: -26.1467,
        centerLng: 28.0416,
        coverageRadiusKm: 25,
        maxDistanceKm: 100,
        active: true,
        pricingEnabled: true,
      },
    });
    const ptaRegion = await prisma.deliveryRegion.create({
      data: {
        name: `Pta Zone ${tag}`,
        slug: `l02-pta-${tag}`,
        coverageMode: "RADIUS",
        city: "Pretoria",
        province: "Gauteng",
        centerLat: -25.7479,
        centerLng: 28.2293,
        coverageRadiusKm: 25,
        maxDistanceKm: 100,
        active: true,
        pricingEnabled: true,
      },
    });
    cleanupRegionIds.push(jhbRegion.id, ptaRegion.id);

    const activeServiceKey = `CLIENT_L02_${tag.toUpperCase()}`;
    const inactiveServiceKey = `CLIENT_L02_OFF_${tag.toUpperCase()}`;
    const activeSvc = await prisma.deliveryServiceDefinition.create({
      data: {
        stableKey: activeServiceKey,
        versionNumber: 1,
        displayName: "Standard L02",
        status: "ACTIVE",
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: adminId,
        pricingPolicy: {
          stableKey: activeServiceKey,
          displayName: "Standard L02",
          active: true,
          turnaround: "1–2 business days",
          provinces: ["Gauteng"],
          regionIds: [jhbRegion.id, ptaRegion.id],
          tariffs: {
            SMALL: { baseFee: "129.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
            MEDIUM: { baseFee: "179.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
            LARGE: { baseFee: "249.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
          },
          expectedVersion: 0,
          reason: "L02 Jhb-Pretoria coverage validation",
        },
        coveragePolicy: { provinces: ["Gauteng"], regionIds: [jhbRegion.id, ptaRegion.id] },
        slaMetadata: { turnaround: "1–2 business days" },
      },
    });
    const inactiveSvc = await prisma.deliveryServiceDefinition.create({
      data: {
        stableKey: inactiveServiceKey,
        versionNumber: 1,
        displayName: "Paused Service",
        status: "DRAFT",
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: adminId,
        pricingPolicy: {
          stableKey: inactiveServiceKey,
          displayName: "Paused Service",
          active: false,
          turnaround: "1–2 business days",
          provinces: ["Gauteng"],
          regionIds: [],
          tariffs: {
            SMALL: { baseFee: "89.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
            MEDIUM: { baseFee: "129.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
            LARGE: { baseFee: "179.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
          },
          expectedVersion: 0,
          reason: "Disabled L02 test service",
        },
        coveragePolicy: { provinces: ["Gauteng"], regionIds: [] },
        slaMetadata: { turnaround: "1–2 business days" },
      },
    });
    cleanupServiceIds.push(activeSvc.id, inactiveSvc.id);
    cleanupServiceKeys.push(activeServiceKey, inactiveServiceKey);

    const baseQuote: PublicQuoteInput = {
      serviceKey: activeServiceKey,
      parcelSize: "SMALL",
      weightKg: "1.5",
      pickupAddress: { line1: "12 Oxford Rd", suburb: "Rosebank", city: "Johannesburg", province: "Gauteng", postalCode: "2196" },
      dropoffAddress: { line1: "200 Burnett St", suburb: "Hatfield", city: "Pretoria", province: "Gauteng", postalCode: "0028" },
    };

    // Positive Jhb -> Pretoria within city/Gauteng coverage succeeds
    const valid = await createPublicQuote(baseQuote);
    expect(valid.total).toBe("129.00");

    // Positive Jhb -> Jhb internal succeeds
    const internalJhb = await createPublicQuote({
      ...baseQuote,
      dropoffAddress: { line1: "77 Juta St", suburb: "Braamfontein", city: "Johannesburg", province: "Gauteng", postalCode: "2001" },
    });
    expect(internalJhb.total).toBe("129.00");

    // Negative: active service but unavailable route (route provider failure fails closed)
    vi.mocked(calculateRoute).mockResolvedValueOnce({
      ok: false,
      error: { code: "MAPS_ROUTE_NOT_FOUND", message: "No drivable road route between coordinates." },
    });
    await expect(createPublicQuote(baseQuote)).rejects.toMatchObject({ status: 503 });

    // Negative: outside enabled province
    await expect(
      createPublicQuote({
        ...baseQuote,
        dropoffAddress: { line1: "10 Adderley St", city: "Cape Town", province: "Western Cape", postalCode: "8001" },
      }),
    ).rejects.toMatchObject({ code: "COVERAGE_UNAVAILABLE", status: 409 });

    // Negative: Gauteng-but-outside-explicit-region-scope (provinces: ["Gauteng"], explicit regionIds: [jhbRegion.id] denies Pretoria ~48km outside jhbRegion)
    const narrowed = await saveDeliveryConfiguration(adminId, {
      stableKey: activeServiceKey,
      displayName: "Standard L02 Jhb Only",
      active: true,
      turnaround: "1–2 business days",
      provinces: ["Gauteng"],
      regionIds: [jhbRegion.id],
      tariffs: {
        SMALL: { baseFee: "129.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
        MEDIUM: { baseFee: "179.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
        LARGE: { baseFee: "249.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
      },
      expectedVersion: 1,
      reason: "Narrow scope to explicit Jhb radius region only",
    });
    expect(narrowed.version).toBe(2);
    await expect(createPublicQuote(baseQuote)).rejects.toMatchObject({ code: "COVERAGE_UNAVAILABLE", status: 409 });

    // Positive: admin province rollout (region activation + service toggle) enables Western Cape without mutating earlier frozen quote
    const wcRegion = await prisma.deliveryRegion.create({
      data: {
        name: `WC Province ${tag}`,
        slug: `l02-wc-${tag}`,
        coverageMode: "PROVINCE",
        province: "Western Cape",
        active: true,
        pricingEnabled: true,
      },
    });
    cleanupRegionIds.push(wcRegion.id);
    const rolledOut = await saveDeliveryConfiguration(adminId, {
      stableKey: activeServiceKey,
      displayName: "Standard L02 Multi-Province Rollout",
      active: true,
      turnaround: "1–2 business days",
      provinces: ["Gauteng", "Western Cape"],
      regionIds: [],
      tariffs: {
        SMALL: { baseFee: "149.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
        MEDIUM: { baseFee: "199.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
        LARGE: { baseFee: "269.00", perKmRate: "0.00", maximumWeightKg: null, minimumCharge: null },
      },
      expectedVersion: 2,
      reason: "Admin rollout toggle enables Western Cape",
    });
    expect(rolledOut.version).toBe(3);
    const capeQuote = await createPublicQuote({
      ...baseQuote,
      dropoffAddress: { line1: "10 Adderley St", city: "Cape Town", province: "Western Cape", postalCode: "8001" },
    });
    expect(capeQuote.total).toBe("149.00");
    const frozenEarlier = await prisma.pricingQuote.findUniqueOrThrow({ where: { id: valid.id } });
    expect(frozenEarlier.total.toFixed(2)).toBe("129.00");

    // Negative: disabled service
    await expect(
      createPublicQuote({ ...baseQuote, serviceKey: inactiveServiceKey }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 409 });

    // High-risk localities block cash on Hillbrow / Pretoria Central CBD / Soweto while non-high-risk Rosebank <-> Hatfield does not
    const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { key: "delivery.high_risk_areas" } });
    const areas = parseHighRiskAreas(setting.value)!;
    expect(evaluateLocalityCashRisk(
      { city: "Johannesburg", suburb: "Hillbrow", province: "Gauteng" },
      { city: "Pretoria", suburb: "Hatfield", province: "Gauteng" },
      areas,
    ).restrictCash).toBe(true);
    expect(evaluateLocalityCashRisk(
      { city: "Pretoria", suburb: "Sunnyside", province: "Gauteng" },
      { city: "Johannesburg", suburb: "Rosebank", province: "Gauteng" },
      areas,
    ).restrictCash).toBe(true);
    expect(evaluateLocalityCashRisk(
      { city: "Johannesburg", suburb: "Rosebank", province: "Gauteng" },
      { city: "Pretoria", suburb: "Hatfield", province: "Gauteng" },
      areas,
    ).restrictCash).toBe(false);

    // Admin edit to region highRisk & high-risk suburb note persists with audit
    await prisma.$transaction(async (tx) => {
      await setDeliveryRegionHighRisk(tx, jhbRegion.id, true);
    });
    const targetAreaId = areas.find((a) => a.cities.includes("Pretoria"))?.id ?? areas[0]!.id;
    const updatedAreas = areas.map((a) => (a.id === targetAreaId ? { ...a, notes: `Updated ${tag}` } : a));
    const updatedSetting = await updateSettingValue(adminId, "delivery.high_risk_areas", updatedAreas);
    expect("error" in updatedSetting).toBe(false);
    const reloaded = parseHighRiskAreas((await prisma.systemSetting.findUniqueOrThrow({ where: { key: "delivery.high_risk_areas" } })).value);
    expect(reloaded?.find((a) => a.id === targetAreaId)?.notes).toBe(`Updated ${tag}`);
  });
});
