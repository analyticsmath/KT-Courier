import type { GeocodableSouthAfricanAddress } from "@/lib/maps/geocode.service";
import { geocodeSouthAfricanAddress } from "@/lib/maps/geocode.service";

export type StoredMerchantPickup = Readonly<{
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | string | { toString(): string } | null;
  longitude?: number | string | { toString(): string } | null;
  placeId?: string | null;
}>;

export type VerifiedStorePickupCoordinates = Readonly<{ latitude: number; longitude: number }>;
export type StorePickupCoordinateResolver = (
  address: GeocodableSouthAfricanAddress,
) => Promise<VerifiedStorePickupCoordinates | null>;

/** Verify a merchant-saved map pin; never silently invent a pickup marker. */
export async function resolveVerifiedStorePickupCoordinates(
  pickup: StoredMerchantPickup | null | undefined,
  resolver: StorePickupCoordinateResolver = geocodeSouthAfricanAddress,
): Promise<VerifiedStorePickupCoordinates | null> {
  if (
    !pickup
    || (pickup.line1?.trim().length ?? 0) < 3
    || (pickup.line2?.trim().length ?? 0) < 2
    || (pickup.city?.trim().length ?? 0) < 2
    || (pickup.province?.trim().length ?? 0) < 2
    || pickup.country?.trim().toLowerCase() !== "south africa"
    || !/^\d{4}$/.test(pickup.postalCode?.trim() ?? "")
    || pickup.latitude == null
    || pickup.longitude == null
  ) return null;

  const latitude = Number(pickup.latitude);
  const longitude = Number(pickup.longitude);
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90
    || longitude < -180 || longitude > 180
    || (latitude === 0 && longitude === 0)
  ) return null;

  const address: GeocodableSouthAfricanAddress = {
    line1: pickup.line1.trim(),
    line2: pickup.line2.trim(),
    city: pickup.city.trim(),
    province: pickup.province.trim(),
    postalCode: pickup.postalCode.trim(),
    country: "South Africa",
    latitude,
    longitude,
    ...(pickup.placeId ? { placeId: pickup.placeId } : {}),
  };
  return resolver(address);
}
