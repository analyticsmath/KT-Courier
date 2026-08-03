// Server-only. Do NOT import into Client Components.
// Use NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY directly in client components.

import { getGoogleMapsServerKey, getGoogleMapsRegionBias } from "@/lib/config/env";

export interface MapsServerConfig {
  serverKey: string;
  regionBias: string;
  routesApiUrl: string;
  geocodeApiUrl: string;
}

export interface MapsFeatureFlags {
  routeCalculationEnabled: boolean;
  geocodingEnabled: boolean;
}

export function getMapsServerConfig(): MapsServerConfig | null {
  const serverKey = getGoogleMapsServerKey();
  if (!serverKey) return null;

  return {
    serverKey,
    regionBias: getGoogleMapsRegionBias(),
    routesApiUrl: "https://routes.googleapis.com/directions/v2:computeRoutes",
    geocodeApiUrl: "https://maps.googleapis.com/maps/api/geocode/json",
  };
}

export function getMapsFeatureFlags(): MapsFeatureFlags {
  const serverKey = getGoogleMapsServerKey();
  return {
    routeCalculationEnabled: !!serverKey,
    geocodingEnabled: !!serverKey,
  };
}
