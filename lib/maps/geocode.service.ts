// Server-only. Resolve customer-entered delivery addresses to trusted coordinates.

import { getMapsServerConfig, type MapsServerConfig } from "./google-maps-config";
import { disposableGeocode, southAfricanAddressQuery } from "@/lib/testing/disposable-geocoding";

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
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

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
