# Phase 2.1 — Address Intelligence, Route Foundation

## Summary

Phase 2.1 adds real address input, coordinate capture, server-side route calculation,
delivery zone matching, and admin region management.

---

## Schema Changes

### Order (new fields)
| Field | Type | Description |
|-------|------|-------------|
| `distanceMeters` | `Int?` | Route distance in meters |
| `durationSeconds` | `Int?` | Estimated duration in seconds |
| `routeProvider` | `String?` | Source: `google_routes`, `client_provided` |
| `routeCalculatedAt` | `DateTime?` | When route was calculated |
| `routeSummary` | `String?` | Human-readable: `32.5 km · ~45 min` |
| `deliveryRegionId` | `String?` | FK to matched DeliveryRegion |

### DeliveryRegion (new fields)
| Field | Type | Description |
|-------|------|-------------|
| `city` | `String?` | Primary city for this region |
| `province` | `String?` | South African province |
| `centerLat` | `Decimal(10,7)?` | Region center latitude |
| `centerLng` | `Decimal(10,7)?` | Region center longitude |
| `coverageRadiusKm` | `Decimal(8,2)?` | Radius for zone matching |
| `baseFee` | `Decimal(10,2)?` | Base delivery fee |
| `maxDistanceKm` | `Decimal(8,2)?` | Maximum delivery distance |
| `notes` | `String?` | Internal admin notes |
| `displayOrder` | `Int` | Sort order (default 0) |

### Address (unchanged)
Phase 1.7 already added `latitude`, `longitude`, `formattedAddress`, `placeId`.

---

## Migration Name
`20250610_phase_2_1_route_foundation`

Run when DATABASE_URL is configured:
```sh
npx prisma migrate dev --name phase_2_1_route_foundation
```

---

## Address Autocomplete Behavior

1. If `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is set and valid:
   - Google Places autocomplete activates on the address input
   - User types → predictions appear → user selects → structured data captured
   - `formattedAddress`, `placeId`, `lat`, `lng`, `line1`, `city`, `province`, `postalCode` populated
   
2. If key is missing or API fails:
   - Manual form shown: line1, city, province, postal code
   - Dev-only warning note displayed
   - No crash, order creation continues

---

## Route Calculation Behavior

1. Order is submitted with pickup + dropoff coordinates
2. `orders.service.ts` calls `calculateRoute()` from `lib/maps/routes.service.ts`
3. Routes API called server-side with both lat/lng pairs
4. On success: `distanceMeters`, `durationSeconds`, `routeSummary`, `routeProvider`, `routeCalculatedAt` stored on Order
5. On failure (missing key, timeout, API error): order created without route data
6. Route data is a snapshot — does not change after order creation

If the client already calculated route data (passed in request body), server uses that
and marks `routeProvider: "client_provided"`.

---

## Delivery Region Matching

1. If dropoff has coordinates: `checkDeliveryZone()` checks all active regions with `centerLat/Lng + coverageRadiusKm`
2. Fallback: `matchRegionByCity()` matches by city or province text
3. If no match: `deliveryRegionId` remains null — order creation is not blocked

---

## Admin Regions

New page: `/admin/regions`

Features:
- List all delivery regions
- Create new regions (name, slug, city, province, center coordinates, radius, max distance, base fee)
- Edit existing regions
- Toggle active/inactive status

New API routes:
- `GET /api/admin/regions` — list all regions
- `POST /api/admin/regions` — create region
- `PATCH /api/admin/regions/[id]` — update or toggle active

---

## Pricing Integration

Phase 2.1 stores `distanceMeters` on the order but does not apply distance-based pricing.
The `PricingRuleType.DISTANCE` enum value exists from Phase 1.7 but is not wired yet.

**Phase 2.5** is the planned phase for distance-based pricing rules.

---

## Known Limitations

1. No live driver tracking (Phase 3 feature)
2. No polygon drawing for delivery zones (planned enhancement)
3. No payment gateway (Phase 3 feature)
4. Google Maps billing must be configured before production use
5. `GOOGLE_MAPS_SERVER_KEY` must be set for route calculation
6. `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` must be set for autocomplete
7. No migration applied until DATABASE_URL is configured and `prisma migrate dev` is run
