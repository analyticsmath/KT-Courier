import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { geocodeSouthAfricanAddress } from "@/lib/maps/geocode.service";
import { checkDeliveryZone } from "@/lib/maps/delivery-zone.service";
import { calculateRoute } from "@/lib/maps/routes.service";
import { getPricingConfiguration } from "@/lib/pricing/config";
import { requireParcelProfile } from "@/lib/commercial/parcel-profiles";
import { calculateDeliveryPrice } from "@/lib/pricing/calculator";
import {
  hashPricingInput,
  pricingInputSnapshot,
} from "@/lib/pricing/input-hash";
import { toQuoteDto } from "@/lib/services/pricing-quote.service";
import {
  DeliveryConfigurationSchema,
  PlatformError,
  type DeliveryConfiguration,
  type PublicQuoteInput,
} from "./contracts";
const VERSION = "client-delivery-v1";
const COOKIE = "kt_public_quote";
export async function guestQuoteOwner(create = false) {
  const jar = await cookies();
  let token = jar.get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) return null;
    token = randomBytes(32).toString("hex");
    jar.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });
  }
  return `guest:${createHash("sha256").update(token).digest("hex")}`;
}
function configuration(row: { pricingPolicy: Prisma.JsonValue | null }) {
  const parsed = DeliveryConfigurationSchema.safeParse(row.pricingPolicy);
  if (!parsed.success)
    throw new PlatformError(
      "SERVICE_INVALID",
      "This service needs administrator configuration.",
      503,
    );
  return parsed.data;
}
export async function deliveryCatalog(all = false) {
  const rows = await prisma.deliveryServiceDefinition.findMany({
    where: {
      stableKey: { startsWith: "CLIENT_" },
      ...(all
        ? {}
        : {
            status: "ACTIVE",
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          }),
    },
    orderBy: [{ stableKey: "asc" }, { versionNumber: "desc" }],
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows)
    if (!latest.has(row.stableKey)) latest.set(row.stableKey, row);
  return [...latest.values()].map((row) => ({
    ...configuration(row),
    version: row.versionNumber,
    id: row.id,
  }));
}
export async function saveDeliveryConfiguration(
  actorId: string,
  input: DeliveryConfiguration,
) {
  const data = DeliveryConfigurationSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.stableKey}))`;
    const prior = await tx.deliveryServiceDefinition.findFirst({
      where: { stableKey: data.stableKey },
      orderBy: { versionNumber: "desc" },
    });
    if ((prior?.versionNumber ?? 0) !== data.expectedVersion)
      throw new PlatformError(
        "VERSION_CONFLICT",
        "Configuration changed. Refresh before saving.",
        409,
      );
    const now = new Date();
    await tx.deliveryServiceDefinition.updateMany({
      where: { stableKey: data.stableKey, status: "ACTIVE" },
      data: { status: "RETIRED", effectiveTo: now },
    });
    const row = await tx.deliveryServiceDefinition.create({
      data: {
        stableKey: data.stableKey,
        versionNumber: (prior?.versionNumber ?? 0) + 1,
        displayName: data.displayName,
        status: data.active ? "ACTIVE" : "DRAFT",
        effectiveFrom: now,
        createdByUserId: actorId,
        pricingPolicy: data,
        coveragePolicy: {
          provinces: data.provinces,
          regionIds: data.regionIds,
        },
        slaMetadata: { turnaround: data.turnaround },
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: actorId,
        action: "UPDATE",
        entityType: "DeliveryServiceDefinition",
        entityId: row.id,
        message: data.reason,
        metadata: { stableKey: data.stableKey, version: row.versionNumber },
      },
    });
    return { id: row.id, version: row.versionNumber };
  });
}
export async function createPublicQuote(input: PublicQuoteInput) {
  const parcelProfile = await requireParcelProfile(input.parcelSize, input.weightKg);
  const selected = (await deliveryCatalog()).find(
    (c) => c.stableKey === input.serviceKey && c.active,
  );
  if (!selected)
    throw new PlatformError(
      "SERVICE_UNAVAILABLE",
      "This delivery service is not currently available.",
      409,
    );
  if (
    ![input.pickupAddress.province, input.dropoffAddress.province].every((p) =>
      selected.provinces.includes(p),
    )
  )
    throw new PlatformError(
      "COVERAGE_UNAVAILABLE",
      "This service is not active in both selected provinces.",
      409,
    );
  const coordinates = await Promise.all([
    geocodeSouthAfricanAddress(input.pickupAddress),
    geocodeSouthAfricanAddress(input.dropoffAddress),
  ]);
  if (!coordinates[0] || !coordinates[1])
    throw new PlatformError(
      "ADDRESS_UNRESOLVED",
      "Check both street addresses and try again.",
      422,
    );
  const zones = await Promise.all(
    coordinates.map((p) => checkDeliveryZone(p!.latitude, p!.longitude)),
  );
  if (
    zones.some(
      (z) => !z.matched || !z.regionId || z.withinMaxDistance !== true,
    )
  )
    throw new PlatformError(
      "COVERAGE_UNAVAILABLE",
      "Both addresses must be inside an active delivery area.",
      409,
    );
  const regions = await prisma.deliveryRegion.findMany({
    where: {
      id: { in: zones.map((z) => z.regionId!) },
      active: true,
      pricingEnabled: true,
    },
  });
  const byId = new Map(regions.map((r) => [r.id, r]));
  if (
    zones.some((z, i) => {
      const r = byId.get(z.regionId!);
      return (
        !r ||
        r.province?.toLowerCase() !==
          [input.pickupAddress, input.dropoffAddress][
            i
          ].province.toLowerCase() ||
        !selected.provinces.some(
          (p) => p.toLowerCase() === r.province?.toLowerCase(),
        ) ||
        (selected.regionIds.length > 0 && !selected.regionIds.includes(r.id))
      );
    })
  )
    throw new PlatformError(
      "COVERAGE_UNAVAILABLE",
      "The mapped addresses are outside this service's active coverage.",
      409,
    );
  const route = await calculateRoute(
    coordinates[0].latitude,
    coordinates[0].longitude,
    coordinates[1].latitude,
    coordinates[1].longitude,
  );
  if (!route.ok || route.route.distanceMeters <= 0)
    throw new PlatformError(
      "ROUTE_UNAVAILABLE",
      "A verified road route is unavailable. Please retry.",
      503,
    );
  const config = await getPricingConfiguration();
  if (regions.some((region) => route.route.distanceMeters > Number(region.maxDistanceKm) * 1000)) {
    throw new PlatformError("COVERAGE_DISTANCE_EXCEEDED", "This route exceeds the configured maximum distance.", 409);
  }
  const tariff = selected.tariffs[input.parcelSize];
  if (tariff.maximumWeightKg && Number(input.weightKg) > tariff.maximumWeightKg)
    throw new PlatformError(
      "WEIGHT_UNSUPPORTED",
      "This parcel exceeds the service weight limit.",
      422,
    );
  const d = (v: string | number) => new Prisma.Decimal(v);
  const bookingInput = {
    deliveryType: "PARCEL_DOCUMENT" as const,
    pickupAddress: {
      ...input.pickupAddress,
      ...coordinates[0],
      country: "South Africa",
    },
    dropoffAddress: {
      ...input.dropoffAddress,
      ...coordinates[1],
      country: "South Africa",
    },
    actualWeightKg: input.weightKg,
  };
  const rule = {
    id: selected.id,
    revision: selected.version,
    currency: "ZAR" as const,
    deliveryType: bookingInput.deliveryType,
    regionId: null,
    baseFee: d(tariff.baseFee),
    perKmRate: d(tariff.perKmRate),
    includedDistanceKm: d(0),
    distanceIncrementKm: d("0.001"),
    minimumCharge: tariff.minimumCharge ? d(tariff.minimumCharge) : null,
    maximumWeightKg: tariff.maximumWeightKg ? d(tariff.maximumWeightKg) : null,
    flatSurcharge: null,
    vehicleClass: null,
    vehicleSurcharge: null,
    includedWeightKg: null,
    perAdditionalKgRate: null,
    weightIncrementKg: null,
    dimensionalPricingEnabled: false,
    volumetricDivisor: null,
    maxDistanceKm: d(Math.min(...regions.map((region) => Number(region.maxDistanceKm)))),
  };
  const calculation = calculateDeliveryPrice({
    input: {
      deliveryType: bookingInput.deliveryType,
      distanceMeters: route.route.distanceMeters,
      durationSeconds: route.route.durationSeconds,
      vehicleClass: null,
      actualWeightKg: d(input.weightKg),
      lengthCm: null,
      widthCm: null,
      heightCm: null,
    },
    rule,
    regionContext: {
      origin: byId.get(zones[0].regionId!)!,
      destination: byId.get(zones[1].regionId!)!,
    },
    taxConfig: config.tax,
    calculationVersion: VERSION,
  });
  const snapshot = pricingInputSnapshot(bookingInput);
  const owner = await guestQuoteOwner(true);
  const quote = await prisma.pricingQuote.create({
    data: {
      ownerType: "CUSTOMER",
      ownerId: owner!,
      deliveryType: bookingInput.deliveryType,
      currency: "ZAR",
      calculationVersion: VERSION,
      inputHash: hashPricingInput(snapshot),
      inputSnapshot: snapshot,
      ruleSnapshot: {
        serviceKey: selected.stableKey,
        configurationId: selected.id,
        version: selected.version,
        parcelSize: input.parcelSize,
        parcelProfileId: parcelProfile.id,
        parcelProfileVersion: parcelProfile.versionNumber,
        tariff,
      },
      regionSnapshot: {
        originRegionId: zones[0].regionId,
        destinationRegionId: zones[1].regionId,
      },
      taxSnapshot: {
        rate: calculation.taxRate.toString(),
        amount: calculation.taxAmount.toFixed(2),
      },
      metadata: {
        serviceName: selected.displayName,
        turnaround: selected.turnaround,
        bookingInput,
        routeSummary: route.route.routeSummary,
      },
      distanceMeters: route.route.distanceMeters,
      durationSeconds: route.route.durationSeconds,
      routeProvider: route.route.provider,
      originRegionId: zones[0].regionId,
      destinationRegionId: zones[1].regionId,
      rawDistanceKm: calculation.rawDistanceKm,
      billableDistanceKm: calculation.billableDistanceKm,
      subtotal: calculation.subtotal,
      taxRate: calculation.taxRate,
      taxAmount: calculation.taxAmount,
      total: calculation.total,
      expiresAt: new Date(Date.now() + config.quoteTtlMinutes * 60000),
      lineItems: {
        create: calculation.lineItems.map((i) => ({
          code: i.code,
          label: i.label,
          quantity: i.quantity,
          unitRate: i.unitRate,
          amount: i.amount,
          currency: "ZAR",
          metadata: i.metadata as Prisma.InputJsonValue | undefined,
        })),
      },
    },
    include: { lineItems: true },
  });
  return {
    ...toQuoteDto(quote),
    serviceName: selected.displayName,
    turnaround: selected.turnaround,
    parcelSize: input.parcelSize,
    pickupSummary: input.pickupAddress.line1,
    dropoffSummary: input.dropoffAddress.line1,
  };
}
export async function readPublicQuote(id: string, userId?: string) {
  const guest = await guestQuoteOwner();
  const owners = [guest, userId].filter((v): v is string => !!v);
  const quote = await prisma.pricingQuote.findFirst({
    where: { id, ownerId: { in: owners }, calculationVersion: VERSION },
    include: { lineItems: true },
  });
  if (!quote)
    throw new PlatformError("QUOTE_NOT_FOUND", "Quote not found.", 404);
  if (quote.status !== "ACTIVE" || quote.expiresAt <= new Date())
    throw new PlatformError(
      "QUOTE_EXPIRED",
      "This quote has expired. Request a new one.",
      409,
    );
  return quote;
}
