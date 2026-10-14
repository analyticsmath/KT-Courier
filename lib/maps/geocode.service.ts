// Server-only. Resolve customer-entered delivery addresses to trusted coordinates.

import { getMapsServerConfig, type MapsServerConfig } from "./google-maps-config";
import { disposableGeocode, southAfricanAddressQuery } from "@/lib/testing/disposable-geocoding";
import { PROVINCES } from "@/lib/client-platform/contracts";

const TIMEOUT_MS = 8_000;

export type GeocodableSouthAfricanAddress = Readonly<{
  line1: string;
  line2?: string;
  suburb?: string;
  city: string;
  province: string;
  postalCode?: string;
}>;

export type TrustedCoordinates = Readonly<{
  latitude: number;
  longitude: number;
}>;

type GeocodeResponse = {
  status?: string;
  results?: Array<{
    partial_match?: boolean;
    types?: string[];
    address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
    geometry?: {
      location_type?: string;
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

/** Resolve province from provider coordinates, never from a shopper's province label. */
export async function reverseGeocodeSouthAfricanProvince(
  latitude: number,
  longitude: number,
  configurationOverride?: MapsServerConfig,
): Promise<(typeof PROVINCES)[number] | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const config = configurationOverride ?? getMapsServerConfig();
  if (!config) return null;
  const url = new URL(config.geocodeApiUrl);
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("result_type", "administrative_area_level_1");
  url.searchParams.set("language", "en");
  url.searchParams.set("key", config.serverKey);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json() as GeocodeResponse;
    if (payload.status !== "OK") return null;
    const provinces = new Set<(typeof PROVINCES)[number]>();
    for (const result of payload.results ?? []) {
      const components = result.address_components ?? [];
      const country = components.find(c => c.types?.includes("country"));
      const province = components.find(c => c.types?.includes("administrative_area_level_1"));
      if (country?.short_name !== "ZA") return null;
      const canonical = PROVINCES.find(p => p.toLowerCase() === province?.long_name?.trim().toLowerCase());
      if (!canonical) return null;
      provinces.add(canonical);
    }
    return provinces.size === 1 ? [...provinces][0] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizedCity(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-ZA").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\b(city|of|metropolitan|municipality|local|district)\b/g, " ").replace(/\s+/g, " ").trim();
}

export async function geocodeSouthAfricanAddress(
  address: GeocodableSouthAfricanAddress,
  configurationOverride?: MapsServerConfig,
): Promise<TrustedCoordinates | null> {
  if (!configurationOverride) {
    const fixture = disposableGeocode(address);
    if (fixture !== undefined) return fixture;
  }
  const config = configurationOverride ?? getMapsServerConfig();
  if (!config) return null;

  const query = southAfricanAddressQuery(address);

  const url = new URL(config.geocodeApiUrl);
  url.searchParams.set("address", query);
  url.searchParams.set("region", config.regionBias || "za");
  url.searchParams.set("components", "country:ZA");
  url.searchParams.set("key", config.serverKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = await response.json() as GeocodeResponse;
    if (payload.status !== "OK") return null;

    // Google can resolve a conflicting street/city query to a province or
    // another town. Such coordinates are not the requested delivery address.
    if (payload.results?.length !== 1) return null;
    const result = payload.results[0];
    if (result.partial_match === true || !["ROOFTOP", "RANGE_INTERPOLATED", "GEOMETRIC_CENTER"].includes(result.geometry?.location_type ?? "")) return null;
    if (!result.types?.some(type => ["street_address", "premise", "subpremise", "establishment", "intersection", "point_of_interest"].includes(type))) return null;
    const components = result.address_components ?? [];
    if (components.find(component => component.types?.includes("country"))?.short_name !== "ZA") return null;
    if (components.find(component => component.types?.includes("administrative_area_level_1"))?.long_name?.trim().toLowerCase() !== address.province.trim().toLowerCase()) return null;
    const city = normalizedCity(address.city);
    const cityMatches = city && components.some(component => component.types?.some(type => ["locality", "postal_town", "administrative_area_level_2", "administrative_area_level_3", "sublocality_level_1"].includes(type)) && normalizedCity(component.long_name ?? "") === city);
    if (!cityMatches) return null;
    const location = result.geometry?.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || location.lat! < -90 || location.lat! > 90 || location.lng! < -180 || location.lng! > 180) return null;

    return Object.freeze({
      latitude: location.lat as number,
      longitude: location.lng as number,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
