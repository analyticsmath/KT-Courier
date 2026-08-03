// Shared types for Google Maps integration (Phase 2.1).
// Safe to import in both server and client files — contains no env access.

// ─── Address DTO (normalized from Google Places or manual input) ──────────────

export interface AddressDto {
  formattedAddress: string;
  placeId: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

// ─── Route result ─────────────────────────────────────────────────────────────

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  routeSummary: string;
  provider: "google_routes" | "e2e_deterministic";
}

export interface RouteError {
  code: "MISSING_KEYS" | "MISSING_COORDINATES" | "API_ERROR" | "TIMEOUT" | "PARSE_ERROR";
  message: string;
}

export type RouteCalculationResult =
  | { ok: true; route: RouteResult }
  | { ok: false; error: RouteError };

// ─── Delivery zone check ──────────────────────────────────────────────────────

export interface DeliveryZoneCheckResult {
  matched: boolean;
  regionId: string | null;
  regionName: string | null;
  withinMaxDistance: boolean | null;
  warningMessage: string | null;
}

// ─── Google Places prediction (client-side) ───────────────────────────────────

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

// ─── Google Routes API request/response shapes ────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RoutesApiRequest {
  origin: { location: { latLng: LatLng } };
  destination: { location: { latLng: LatLng } };
  travelMode: "DRIVE";
  routingPreference?: "TRAFFIC_AWARE" | "TRAFFIC_UNAWARE";
  computeAlternativeRoutes: false;
}

export interface RoutesApiRoute {
  distanceMeters: number;
  duration: string;
  description?: string;
}

export interface RoutesApiResponse {
  routes?: RoutesApiRoute[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}
