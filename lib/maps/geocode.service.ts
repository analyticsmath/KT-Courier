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
    address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
    geometry?: {
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

    const location = payload.results?.[0]?.geometry?.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;

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
