// Server-only. Do NOT import into Client Components.
// Checks whether coordinates fall within configured delivery regions.

import { prisma } from "@/lib/db/prisma";
import type { DeliveryZoneCheckResult } from "./google-maps.types";

// ─── Haversine distance (km) between two lat/lng points ──────────────────────

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

// ─── Check whether a dropoff coordinate is within any active region ───────────

export async function checkDeliveryZone(
  dropoffLat: number,
  dropoffLng: number
): Promise<DeliveryZoneCheckResult> {
  let regions;
  try {
    regions = await prisma.deliveryRegion.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        centerLat: true,
        centerLng: true,
        coverageRadiusKm: true,
        maxDistanceKm: true,
      },
      orderBy: { displayOrder: "asc" },
    });
  } catch {
    // If DB is unavailable, treat as unknown (don't block order creation)
    return {
      matched: false,
      regionId: null,
      regionName: null,
      withinMaxDistance: null,
      warningMessage: "Service area check unavailable. Please contact us to confirm coverage.",
      calculationType: "geometric_haversine",
    };
  }

  if (regions.length === 0) {
    return {
      matched: false,
      regionId: null,
      regionName: null,
      withinMaxDistance: null,
      warningMessage: null,
      calculationType: "geometric_haversine",
    };
  }

  for (const region of regions) {
    if (!region.centerLat || !region.centerLng) continue;

    const centerLat = Number(region.centerLat);
    const centerLng = Number(region.centerLng);

    if (!region.coverageRadiusKm) continue;

    const distKm = haversineKm(dropoffLat, dropoffLng, centerLat, centerLng);
    const radiusKm = Number(region.coverageRadiusKm);

    if (distKm <= radiusKm) {
      const withinMaxDistance = region.maxDistanceKm
        ? distKm <= Number(region.maxDistanceKm)
        : null;

      return {
        matched: true,
        regionId: region.id,
        regionName: region.name,
        withinMaxDistance,
        warningMessage: withinMaxDistance === false
          ? `This address may exceed the maximum delivery distance for ${region.name}.`
          : null,
        calculationType: "geometric_haversine",
      };
    }
  }

  return {
    matched: false,
    regionId: null,
    regionName: null,
    withinMaxDistance: null,
    warningMessage:
      "This address may be outside our current service area. Please contact us to confirm coverage.",
    calculationType: "geometric_haversine",
  };
}

// ─── Match order to a delivery region by dropoff city/province (fallback) ─────

export async function matchRegionByCity(
  city: string | null,
  province: string | null
): Promise<{ regionId: string | null; regionName: string | null }> {
  if (!city && !province) return { regionId: null, regionName: null };

  try {
    const regions = await prisma.deliveryRegion.findMany({
      where: {
        active: true,
        OR: [
          city ? { city: { equals: city, mode: "insensitive" } } : undefined,
          province ? { province: { equals: province, mode: "insensitive" } } : undefined,
        ].filter(Boolean) as { city?: { equals: string; mode: "insensitive" }; province?: { equals: string; mode: "insensitive" } }[],
      },
      select: { id: true, name: true },
      orderBy: { displayOrder: "asc" },
      take: 1,
    });

    if (regions[0]) {
      return { regionId: regions[0].id, regionName: regions[0].name };
    }
  } catch {
    // non-blocking
  }

  return { regionId: null, regionName: null };
}
