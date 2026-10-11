import { isDisposableBrowserValidationAllowed } from "./safe-postgres-validator";
import type { GeocodableSouthAfricanAddress, TrustedCoordinates } from "@/lib/maps/geocode.service";

export function southAfricanAddressQuery(address: GeocodableSouthAfricanAddress): string {
  return [address.line1, address.line2, address.suburb, address.city, address.province, address.postalCode, "South Africa"].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()).join(", ");
}

/** Undefined selects the real provider. Null is an explicit fixture rejection. */
export function disposableGeocode(address: GeocodableSouthAfricanAddress, env = process.env): TrustedCoordinates | null | undefined {
  const serialized = env.KT_E2E_GEOCODE_FIXTURES;
  if (!serialized) return undefined;
  if (!isDisposableBrowserValidationAllowed(env) || serialized.length > 8192) return null;
  try {
    const fixtures = JSON.parse(serialized) as Record<string, unknown>;
    if (!fixtures || Array.isArray(fixtures) || typeof fixtures !== "object" || Object.keys(fixtures).length > 32) return null;
    const value = fixtures[southAfricanAddressQuery(address)] as TrustedCoordinates | undefined;
    if (!value || typeof value !== "object" || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180) return null;
    return Object.freeze({ latitude: value.latitude, longitude: value.longitude });
  } catch { return null; }
}
