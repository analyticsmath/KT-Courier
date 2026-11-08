import { isDisposableBrowserValidationAllowed } from "./safe-postgres-validator";
import type { GeocodableSouthAfricanAddress, TrustedCoordinates } from "@/lib/maps/geocode.service";

export function southAfricanAddressQuery(address: GeocodableSouthAfricanAddress): string {
  // A canonical store PICKUP persists its suburb in Address.line2. The
  // verifier also supplies suburb=line2 for strict locality matching.
  // Appending both produces "Central, Central", rejecting legitimate
  // provider evidence and every exact-address disposable browser fixture.
  const line2 = address.line2?.trim();
  const suburb = address.suburb?.trim();
  const normalized = (value: string | undefined) => value?.replace(/\s+/g, " ").toLocaleLowerCase("en-ZA");
  return [
    address.line1, line2,
    suburb && normalized(suburb) !== normalized(line2) ? suburb : undefined,
    address.city, address.province, address.postalCode, "South Africa",
  ].filter((value): value is string => Boolean(value?.trim())).map(value => value.trim()).join(", ");
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
