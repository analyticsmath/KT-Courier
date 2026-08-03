# Google Maps Integration

KT Couriers Phase 2.1 adds Google Maps Platform support for address intelligence and route estimation.

---

## Required Google APIs

Enable these APIs in your Google Cloud project:

| API | Used for |
|-----|---------|
| Maps JavaScript API | Loading the Maps JS SDK in the browser (Places autocomplete UI) |
| Places API | Address autocomplete predictions and place details |
| Routes API | Server-side route distance and duration calculation |

Optional:
- **Geocoding API** — not used in Phase 2.1 but may be needed in future phases.

---

## Environment Variables

| Variable | Where used | Required |
|----------|-----------|---------|
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Browser (Maps JS + Places autocomplete) | For autocomplete |
| `GOOGLE_MAPS_SERVER_KEY` | Server only (Routes API) | For route calculation |
| `GOOGLE_MAPS_REGION_BIAS` | Both | Optional (default: `ZA`) |

**Never expose `GOOGLE_MAPS_SERVER_KEY` to the browser.** It must only be used in server-side code (`lib/maps/`).

---

## API Key Restrictions

### Browser Key (`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`)

Set HTTP referrer restrictions in Google Cloud Console:
- `https://yourdomain.com/*`
- `https://www.yourdomain.com/*`
- `http://localhost:3000/*` (development only)

Restrict to APIs:
- Maps JavaScript API
- Places API

### Server Key (`GOOGLE_MAPS_SERVER_KEY`)

Set IP restrictions or server-to-server API restrictions:
- Restrict by server IP if hosting on a static IP (recommended)
- Or restrict to: Routes API only

---

## Billing and Cost Warning

Google Maps Platform requires billing enabled.

Estimated costs (as of 2024 — verify current pricing):
- Places Autocomplete: ~$0.017 per request (after free tier)
- Routes API: ~$0.005 per request (after free tier)
- Free tier: $200/month credit

Monitor usage in Google Cloud Console. Set budget alerts.

---

## Graceful Fallback

If `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is missing or invalid:
- `AddressAutocomplete` shows manual address input fields
- In development, a non-scary warning note is displayed
- No crash — order creation continues to work

If `GOOGLE_MAPS_SERVER_KEY` is missing:
- Route calculation returns `{ ok: false, error: { code: "MISSING_KEYS" } }`
- Orders are created without route data (`distanceMeters`, `durationSeconds` remain null)
- Pricing is not affected (Phase 2.1 pricing does not require distance)

---

## Files

### Server-side (never import in client components)
- `lib/maps/google-maps-config.ts` — reads server key, returns config
- `lib/maps/routes.service.ts` — calls Routes API, returns distance/duration
- `lib/maps/delivery-zone.service.ts` — matches dropoff to delivery regions
- `lib/maps/address-normalizer.ts` — parses Google Places response

### Client-safe
- `lib/maps/google-maps.types.ts` — shared type definitions
- `lib/maps/use-places-autocomplete.ts` — React hook, loads Maps JS API
- `components/maps/AddressAutocomplete.tsx` — address input with autocomplete + manual fallback
- `components/maps/AddressSummaryCard.tsx` — display only
- `components/maps/RoutePreviewCard.tsx` — display only

---

## Not Implemented in Phase 2.1

- Live driver tracking
- Map rendering (MapPreview component)
- Polygon-based delivery zone drawing
- Geocoding API integration (street-only searches)
- Places API v3 migration (using classic Places API)
