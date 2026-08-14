import { prisma } from "@/lib/db/prisma";
import { checkDeliveryZone } from "@/lib/maps/delivery-zone.service";

export type ServiceabilityRequest = Readonly<{
  storeId?: string | null;
  destination: { latitude: number; longitude: number; province?: string | null };
  now?: Date;
}>;

type StringList = readonly string[];

function jsonStringList(value: unknown): StringList {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : [];
}

function isStoreAvailable(args: { scope: string; provinces: unknown; zoneIds: unknown; province: string | null | undefined; regionId: string | null }) {
  if (args.scope === "NATIONWIDE") return true;
  if (args.scope === "PROVINCES") {
    const allowed = jsonStringList(args.provinces).map((province) => province.toLocaleLowerCase());
    return !!args.province && allowed.includes(args.province.toLocaleLowerCase());
  }
  if (args.scope === "ZONES") return !!args.regionId && jsonStringList(args.zoneIds).includes(args.regionId);
  return false;
}

/**
 * Canonical availability authority. Store territory is intentionally evaluated
 * independently from public discovery and operational courier coverage: callers
 * must never hide catalogue content merely because this returns unserviceable.
 */
export async function evaluateServiceability(input: ServiceabilityRequest) {
  const now = input.now ?? new Date();
  const coverage = await checkDeliveryZone(input.destination.latitude, input.destination.longitude);
  const territory = input.storeId
    ? await prisma.storeSellingTerritory.findUnique({ where: { storeId: input.storeId } })
    : null;
  const storeAvailable = territory
    ? isStoreAvailable({ ...territory, province: input.destination.province, regionId: coverage.regionId })
    : true; // explicit business default: a store sells nationwide until restricted.

  const services = await prisma.deliveryServiceDefinition.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: [{ sortOrder: "asc" }, { stableKey: "asc" }, { versionNumber: "desc" }],
  });

  const availableServices = coverage.matched && storeAvailable
    ? services.filter((service) => {
      const permittedRegions = jsonStringList((service.coveragePolicy as { regionIds?: unknown } | null)?.regionIds);
      return permittedRegions.length === 0 || (!!coverage.regionId && permittedRegions.includes(coverage.regionId));
    })
    : [];
  const serviceable = coverage.matched && coverage.withinMaxDistance !== false && storeAvailable && availableServices.length > 0;
  const reasonCode = !storeAvailable
    ? "STORE_TERRITORY_RESTRICTED"
    : !coverage.matched
      ? "KT_COVERAGE_UNAVAILABLE"
      : coverage.withinMaxDistance === false
        ? "KT_COVERAGE_DISTANCE_EXCEEDED"
        : availableServices.length === 0
          ? "NO_DELIVERY_SERVICE_AVAILABLE"
          : "SERVICEABLE";

  return {
    serviceable,
    reasonCode,
    storeAvailable,
    operationalCoverage: {
      regionId: coverage.regionId,
      regionName: coverage.regionName,
      evidenceType: coverage.calculationType,
      withinMaxDistance: coverage.withinMaxDistance,
    },
    availableServices: availableServices.map((service) => ({
      id: service.id,
      stableKey: service.stableKey,
      versionNumber: service.versionNumber,
      displayName: service.displayName,
      operationalMode: service.operationalMode,
      slaMetadata: service.slaMetadata,
    })),
  };
}
