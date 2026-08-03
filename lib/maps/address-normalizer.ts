// Server-safe address normalization utilities.
// Converts raw place data into our internal AddressDto.

import type { AddressDto } from "./google-maps.types";

// ─── Google Places address_components parser ──────────────────────────────────

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

function extractComponent(
  components: AddressComponent[],
  type: string,
  useShort = false
): string | null {
  const found = components.find((c) => c.types.includes(type));
  if (!found) return null;
  return useShort ? found.short_name : found.long_name;
}

export function normalizeGooglePlaceAddress(place: {
  formatted_address?: string;
  place_id?: string;
  address_components?: AddressComponent[];
  geometry?: { location?: { lat: number | (() => number); lng: number | (() => number) } };
}): AddressDto {
  const components = place.address_components ?? [];

  const streetNumber = extractComponent(components, "street_number");
  const route = extractComponent(components, "route");
  const sublocality = extractComponent(components, "sublocality_level_1") ?? extractComponent(components, "sublocality");
  const locality = extractComponent(components, "locality");
  const adminArea2 = extractComponent(components, "administrative_area_level_2");
  const adminArea1 = extractComponent(components, "administrative_area_level_1");
  const postalCode = extractComponent(components, "postal_code");
  const country = extractComponent(components, "country") ?? "South Africa";

  const line1Parts = [streetNumber, route].filter(Boolean);
  const line1 = line1Parts.length > 0 ? line1Parts.join(" ") : (sublocality ?? "");

  const city = locality ?? sublocality ?? adminArea2 ?? null;

  let lat: number | null = null;
  let lng: number | null = null;
  if (place.geometry?.location) {
    const loc = place.geometry.location;
    lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
    lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
  }

  return {
    formattedAddress: place.formatted_address ?? [line1, city, adminArea1, postalCode, country].filter(Boolean).join(", "),
    placeId: place.place_id ?? null,
    line1: line1 || (place.formatted_address ?? ""),
    line2: null,
    city,
    province: adminArea1,
    postalCode,
    country,
    latitude: lat,
    longitude: lng,
  };
}

// ─── Validate that an AddressDto has required fields ─────────────────────────

export interface AddressValidationResult {
  valid: boolean;
  missingFields: string[];
}

export function validateAddressDto(addr: Partial<AddressDto>): AddressValidationResult {
  const missing: string[] = [];

  if (!addr.line1 || addr.line1.trim().length < 3) missing.push("line1");
  if (!addr.formattedAddress || addr.formattedAddress.trim().length < 3) missing.push("formattedAddress");

  return { valid: missing.length === 0, missingFields: missing };
}

// ─── Build a human-readable address summary ───────────────────────────────────

export function buildAddressSummary(addr: Partial<AddressDto>): string {
  const parts = [addr.line1, addr.city, addr.province].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return addr.formattedAddress ?? "—";
}
