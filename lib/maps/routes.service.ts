// Server-only. Do NOT import into Client Components.
// Calculates route distance and duration using the Google Routes API.

import { getMapsServerConfig } from "./google-maps-config";
import type {
  RouteCalculationResult,
  RoutesApiRequest,
  RoutesApiResponse,
} from "./google-maps.types";

const TIMEOUT_MS = 8_000;

// ─── Main route calculation ───────────────────────────────────────────────────

export async function calculateRoute(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
): Promise<RouteCalculationResult> {
  // The isolated browser suite supplies a deterministic in-process provider. It
  // is intentionally opt-in and never available in normal runtime deployments.
  if (process.env.E2E_ROUTE_PROVIDER === "deterministic") {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: {
          code: "MAPS_MOCK_REJECTED_IN_PRODUCTION",
          message: "Deterministic route mock provider is strictly prohibited in production.",
        },
      };
    }
    if (![pickupLat, pickupLng, dropoffLat, dropoffLng].every(Number.isFinite)) {
      return { ok: false, error: { code: "PARSE_ERROR", message: "E2E route coordinates are invalid." } };
    }
    return {
      ok: true,
      route: {
        distanceMeters: 5000,
        durationSeconds: 900,
        routeSummary: "5.0 km · ~15 min",
        provider: "e2e_deterministic",
      },
    };
  }
  const config = getMapsServerConfig();

  if (!config) {
    return {
      ok: false,
      error: {
        code: "MAPS_CREDENTIALS_MISSING",
        message: "GOOGLE_MAPS_SERVER_KEY is not configured. Route calculation unavailable.",
      },
    };
  }

  const body: RoutesApiRequest = {
    origin: { location: { latLng: { latitude: pickupLat, longitude: pickupLng } } },
    destination: { location: { latLng: { latitude: dropoffLat, longitude: dropoffLng } } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    computeAlternativeRoutes: false,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(config.routesApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.serverKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.description",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      return {
        ok: false,
        error: {
          code: "MAPS_QUOTA_EXCEEDED",
          message: "Google Routes API quota exceeded.",
        },
      };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown");
      return {
        ok: false,
        error: {
          code: "MAPS_PROVIDER_UNAVAILABLE",
          message: `Routes API returned HTTP ${response.status}: ${text.slice(0, 200)}`,
        },
      };
    }

    const data = (await response.json()) as RoutesApiResponse;

    if (data.error) {
      return {
        ok: false,
        error: {
          code: "MAPS_PROVIDER_UNAVAILABLE",
          message: `Routes API error ${data.error.code}: ${data.error.message}`,
        },
      };
    }

    const route = data.routes?.[0];
    if (!route) {
      return {
        ok: false,
        error: {
          code: "MAPS_ROUTE_NOT_FOUND",
          message: "Routes API returned no routes between specified origin and destination.",
        },
      };
    }

    const durationSeconds = parseDurationSeconds(route.duration);
    const distanceKm = (route.distanceMeters / 1000).toFixed(1);
    const durationMin = Math.round(durationSeconds / 60);
    const routeSummary = `${distanceKm} km · ~${durationMin} min`;

    return {
      ok: true,
      route: {
        distanceMeters: route.distanceMeters,
        durationSeconds,
        routeSummary,
        provider: "google_routes",
      },
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: { code: "MAPS_PROVIDER_TIMEOUT", message: "Route calculation request timed out." },
      };
    }

    return {
      ok: false,
      error: {
        code: "MAPS_PROVIDER_UNAVAILABLE",
        message: err instanceof Error ? err.message : "Unknown route calculation error.",
      },
    };
  }
}

// ─── Parse Routes API duration string (e.g. "1234s") to seconds ──────────────

function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const match = /^([0-9.]+)s$/.exec(duration);
  if (match) return Math.round(parseFloat(match[1]));
  return 0;
}

// ─── Format helpers (safe to call anywhere) ──────────────────────────────────

export function formatRouteSummary(distanceMeters: number, durationSeconds: number): string {
  const km = (distanceMeters / 1000).toFixed(1);
  const min = Math.round(durationSeconds / 60);
  return `${km} km · ~${min} min`;
}
