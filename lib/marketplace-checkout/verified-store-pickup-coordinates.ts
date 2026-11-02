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
  const line1 = pickup?.line1?.trim();
  const line2 = pickup?.line2?.trim();
  const city = pickup?.city?.trim();
  const province = pickup?.province?.trim();
  const postalCode = pickup?.postalCode?.trim();
  if (
    !line1 || line1.length < 3
    || !line2 || line2.length < 2
    || !city || city.length < 2
    || !province || province.length < 2
    || pickup?.country?.trim().toLowerCase() !== "south africa"
    || !/^\d{4}$/.test(postalCode ?? "")
    || pickup?.latitude == null
    || pickup?.longitude == null
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
    line1,
    line2,
    city,
    province,
    postalCode,
    country: "South Africa",
    suburb: pickup.line2.trim(),
    requireSuburbAndPostalMatch: true,
    latitude,
    longitude,
    ...(pickup.placeId ? { placeId: pickup.placeId } : {}),
  };
  return resolver(address);
}
