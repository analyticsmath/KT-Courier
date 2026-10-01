import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({
  cookies: { get: vi.fn(), set: vi.fn() },
  geocode: vi.fn(),
  zone: vi.fn(),
  route: vi.fn(),
  config: vi.fn(),
  deliveryServiceDefinition: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  deliveryRegion: { findMany: vi.fn() },
  pricingQuote: { create: vi.fn(), findFirst: vi.fn() },
  adminActivityLog: { create: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookies }));
vi.mock("@/lib/maps/geocode.service", () => ({
  geocodeSouthAfricanAddress: mocks.geocode,
}));
vi.mock("@/lib/maps/delivery-zone.service", () => ({
  checkDeliveryZone: mocks.zone,
}));
vi.mock("@/lib/maps/routes.service", () => ({ calculateRoute: mocks.route }));
vi.mock("@/lib/pricing/config", () => ({
  getPricingConfiguration: mocks.config,
}));
import {
  createPublicQuote,
  readPublicQuote,
  saveDeliveryConfiguration,
} from "@/lib/client-platform/delivery.service";
import {
  PublicQuoteSchema,
  DeliveryConfigurationSchema,
} from "@/lib/client-platform/contracts";
import { INITIAL_DELIVERY } from "@/lib/client-platform/initial-delivery";
const address = {
  line1: "1 Test Street",
  city: "Johannesburg",
  province: "Gauteng" as const,
};
const input = {
  serviceKey: "CLIENT_STANDARD",
  parcelSize: "SMALL" as const,
  weightKg: "1.0000",
  pickupAddress: address,
  dropoffAddress: address,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.deliveryServiceDefinition.findMany.mockResolvedValue(
    INITIAL_DELIVERY.map((c, i) => ({
      id: `config-${i}`,
      stableKey: c.stableKey,
      versionNumber: 1,
      pricingPolicy: c,
    })),
  );
  mocks.geocode.mockResolvedValue({ latitude: -26.2, longitude: 28.03 });
  mocks.zone.mockResolvedValue({
    matched: true,
    regionId: "region-a",
    withinMaxDistance: true,
  });
  mocks.deliveryRegion.findMany.mockResolvedValue([
    {
      id: "region-a",
      province: "Gauteng",
      highRiskSurcharge: new Prisma.Decimal(0),
      pricingEnabled: true,
    },
  ]);
  mocks.route.mockResolvedValue({
    ok: true,
    route: {
      distanceMeters: 10000,
      durationSeconds: 1200,
      provider: "GOOGLE_ROUTES",
      routeSummary: "Verified road route",
    },
  });
  mocks.config.mockResolvedValue({
    tax: { enabled: false, rate: new Prisma.Decimal("0.15"), source: "test" },
    quoteTtlMinutes: 15,
  });
  mocks.pricingQuote.create.mockImplementation(async ({ data }) => ({
    ...data,
    id: "quote-a",
    lineItems: data.lineItems.create,
  }));
  mocks.$transaction.mockImplementation(async (callback) => callback(mocks));
});
describe("anonymous client delivery quotations", () => {
  it.each([
    ["CLIENT_ECONOMY", "SMALL", "89.00"],
    ["CLIENT_ECONOMY", "MEDIUM", "129.00"],
    ["CLIENT_ECONOMY", "LARGE", "179.00"],
    ["CLIENT_STANDARD", "SMALL", "129.00"],
    ["CLIENT_STANDARD", "MEDIUM", "179.00"],
    ["CLIENT_STANDARD", "LARGE", "249.00"],
  ] as const)(
    "prices %s/%s at the client rate %s",
    async (serviceKey, parcelSize, expected) => {
      const quote = await createPublicQuote({
        ...input,
        serviceKey,
        parcelSize,
      });
      expect(quote.total).toBe(expected);
      expect(quote.lineItems[0].amount).toBe(expected);
      expect(
        mocks.pricingQuote.create.mock.calls[0][0].data.metadata.bookingInput
          .deliveryType,
      ).toBe("PARCEL_DOCUMENT");
    },
  );
  it("keeps the final Standard turnaround separate from future collection", async () => {
    expect((await createPublicQuote(input)).turnaround).toBe(
      "1–2 business days",
    );
  });
  it("does not activate Express without client parcel fees", async () => {
    await expect(
      createPublicQuote({ ...input, serviceKey: "CLIENT_EXPRESS" }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(mocks.pricingQuote.create).not.toHaveBeenCalled();
  });
  it("does not invent a road route when the provider is unavailable", async () => {
    mocks.route.mockResolvedValue({ ok: false });
    await expect(createPublicQuote(input)).rejects.toMatchObject({
      code: "ROUTE_UNAVAILABLE",
    });
    expect(mocks.pricingQuote.create).not.toHaveBeenCalled();
  });
  it("requires geocodable street addresses", async () => {
    mocks.geocode.mockResolvedValue(null);
    await expect(createPublicQuote(input)).rejects.toMatchObject({
      code: "ADDRESS_UNRESOLVED",
    });
    expect(mocks.route).not.toHaveBeenCalled();
  });
  it("fails closed when coverage verification is unavailable", async () => {
    mocks.zone.mockResolvedValue({ matched: false, regionId: null });
    await expect(createPublicQuote(input)).rejects.toMatchObject({
      code: "COVERAGE_UNAVAILABLE",
    });
  });
  it("checks mapped region province rather than trusting the user's province", async () => {
    mocks.deliveryRegion.findMany.mockResolvedValue([
      {
        id: "region-a",
        province: "Western Cape",
        highRiskSurcharge: new Prisma.Decimal(0),
      },
    ]);
    await expect(createPublicQuote(input)).rejects.toMatchObject({
      code: "COVERAGE_UNAVAILABLE",
    });
  });
  it("keeps non-operational provinces unavailable", async () => {
    await expect(
      createPublicQuote({
        ...input,
        dropoffAddress: { ...address, province: "Limpopo" },
      }),
    ).rejects.toMatchObject({ code: "COVERAGE_UNAVAILABLE" });
  });
  it("stores an unpredictable guest owner in an HTTP-only cookie", async () => {
    await createPublicQuote(input);
    expect(mocks.cookies.set).toHaveBeenCalledWith(
      "kt_public_quote",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
    expect(mocks.pricingQuote.create.mock.calls[0][0].data.ownerId).toMatch(
      /^guest:[a-f0-9]{64}$/,
    );
  });
  it("does not reveal someone else's quote without a guest cookie or matching user", async () => {
    mocks.pricingQuote.findFirst.mockResolvedValue(null);
    await expect(readPublicQuote("stolen-id")).rejects.toMatchObject({
      code: "QUOTE_NOT_FOUND",
    });
    expect(
      mocks.pricingQuote.findFirst.mock.calls[0][0].where.ownerId.in,
    ).toEqual([]);
  });
  it("rejects totals, zero weight and excess precision supplied by a client", () => {
    expect(
      PublicQuoteSchema.safeParse({ ...input, total: "1.00" }).success,
    ).toBe(false);
    expect(
      PublicQuoteSchema.safeParse({ ...input, weightKg: "0" }).success,
    ).toBe(false);
    expect(
      PublicQuoteSchema.safeParse({ ...input, weightKg: "1.00001" }).success,
    ).toBe(false);
  });
  it("requires a positive tariff for every active parcel size", () => {
    expect(
      DeliveryConfigurationSchema.safeParse({
        ...INITIAL_DELIVERY[0],
        tariffs: INITIAL_DELIVERY[2].tariffs,
        active: true,
      }).success,
    ).toBe(true);
    const free = {
      ...INITIAL_DELIVERY[2],
      active: true,
      tariffs: {
        ...INITIAL_DELIVERY[2].tariffs,
        SMALL: { ...INITIAL_DELIVERY[2].tariffs.SMALL, perKmRate: "0.00" },
      },
    };
    expect(DeliveryConfigurationSchema.safeParse(free).success).toBe(false);
  });
  it("rejects stale configuration versions before writing or auditing", async () => {
    mocks.deliveryServiceDefinition.findFirst.mockResolvedValue({
      versionNumber: 2,
    });
    await expect(
      saveDeliveryConfiguration("admin", INITIAL_DELIVERY[0]),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(mocks.adminActivityLog.create).not.toHaveBeenCalled();
    expect(mocks.deliveryServiceDefinition.create).not.toHaveBeenCalled();
  });
});
