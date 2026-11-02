import { geocodeSouthAfricanAddress, type GeocodableSouthAfricanAddress, type TrustedCoordinates } from "@/lib/maps/geocode.service";

/**
 * Merchant-entered coordinates are only a browser marker, never courier
 * location authority. Verify the saved address using the server map provider
 * before checking coverage or creating a priced courier quote.
 */
export type StoredMerchantPickup = Readonly<{
  line1: string;
  line2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  placeId?: string | null;
  latitude?: { toString(): string } | number | null;
  longitude?: { toString(): string } | number | null;
}>;

export async function resolveVerifiedStorePickupCoordinates(
  pickup: StoredMerchantPickup,
  resolver: (address: GeocodableSouthAfricanAddress) => Promise<TrustedCoordinates | null> = geocodeSouthAfricanAddress,
): Promise<TrustedCoordinates | null> {
  if (!pickup.line1?.trim() || !pickup.city?.trim() || !pickup.province?.trim()) return null;
  // Missing coordinates permit independent forward geocoding. If a saved
  // marker exists, supply it so a selected Place ID must match provider data.
  const hasMarker = pickup.latitude != null && pickup.longitude != null;
  const latitude = hasMarker ? Number(pickup.latitude) : undefined;
  const longitude = hasMarker ? Number(pickup.longitude) : undefined;
  if (hasMarker && (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude!) > 90 || Math.abs(longitude!) > 180
    || (latitude === 0 && longitude === 0))) return null;
  // A Place ID with no marker cannot be verified against the original
  // selected location: use strict address-based geocoding instead.
  const address: GeocodableSouthAfricanAddress = {
    line1: pickup.line1,
    line2: pickup.line2 ?? undefined,
    city: pickup.city,
    province: pickup.province,
    postalCode: pickup.postalCode ?? undefined,
    ...(hasMarker ? { latitude, longitude, placeId: pickup.placeId ?? undefined } : {}),
  };
  return resolver(address);
}
