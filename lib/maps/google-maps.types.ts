// Shared types for Google Maps integration (Phase 2.1).
// Safe to import in both server and client files — contains no env access.

export type MapsResultCode =
  | "MAPS_PROVIDER_DISABLED"
  | "MAPS_CREDENTIALS_MISSING"
  | "MAPS_PROVIDER_UNAVAILABLE"
  | "MAPS_PROVIDER_TIMEOUT"
  | "MAPS_QUOTA_EXCEEDED"
  | "MAPS_ADDRESS_NOT_FOUND"
  | "MAPS_ROUTE_NOT_FOUND"
  | "MAPS_APPROXIMATE_RESULT"
  | "MAPS_PROVIDER_RESULT"
  | "MAPS_MOCK_REJECTED_IN_PRODUCTION";

// ─── Address DTO ─────────────────────────────────────────────────────────────

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
  isApproximate?: boolean;
}

export interface RouteError {
  code: MapsResultCode | "MISSING_KEYS" | "MISSING_COORDINATES" | "API_ERROR" | "TIMEOUT" | "PARSE_ERROR" | "MOCK_REJECTED_IN_PRODUCTION";
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
  calculationType: "geometric_haversine" | "provider_road";
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
