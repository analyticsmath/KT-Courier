# Store Pickup Address

Phase 2.3 adds a coordinate-capable default pickup address for store accounts.

## Behavior

- Store users manage the default pickup address from `/store/profile`.
- The pickup address uses `AddressAutocomplete`, so Google Places coordinates and `placeId` are captured when available.
- Manual fallback works when Google Maps browser keys are not configured.
- `/store/new-delivery` prefills pickup details from the store default pickup address.
- Store users can override pickup details for a specific order without mutating the default.
- Updating the default pickup address does not send email notifications.

## Data Model

- Store default pickup addresses reuse `Address` with `storeId`, `type = PICKUP`, and `isDefault = true`.
- `Store.defaultPickupAddressId` points to the active default pickup address.
- Basic fields are mirrored back to `Store.addressLine1`, `city`, and related columns for backward-compatible display.
- Order creation still creates separate snapshot pickup/dropoff `Address` rows.

## Security

- API routes require an authenticated `STORE`.
- Store users can only read or update the pickup address for their own owned store.
- Mutations use Zod validation, origin checks, safe error responses, and address mutation rate limiting.

## Files

- `lib/services/store-addresses.service.ts`
- `app/api/store/pickup-address/route.ts`
- `components/store/StorePickupAddressManager.tsx`
- `app/(store)/store/profile/page.tsx`
- `app/(store)/store/new-delivery/page.tsx`
