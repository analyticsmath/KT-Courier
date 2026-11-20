import { PlatformError } from "./contracts";
import { completeStorePickupAddress, type StorePickupAddressCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";

type QuotePickup = Readonly<{ line1?: string | null; line2?: string | null; suburb?: string | null; city?: string | null; province?: string | null; postalCode?: string | null; placeId?: string | null; latitude?: number | null; longitude?: number | null }>;

/** A merchant outbound parcel must collect at its saved, mapped, store-owned
 * collection location, resolved by getStorePickupAddressForStore(storeId).
 * A quote may not be redirected to an unrelated address.
 * Pickup certification for marketplace go-Live remains an independent gate. */
export function assertStoreParcelPickupMatches(
  requested: QuotePickup,
  saved: StorePickupAddressCandidate | null | undefined,
): void {
  if (!completeStorePickupAddress(saved) || saved?.type !== "PICKUP") {
    throw new PlatformError(
      "STORE_PICKUP_NOT_CONFIGURED",
      "Add and verify the store collection address, suburb, postal code and map pin before requesting a courier.",
      409,
    );
  }
  const normalized = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  // Some Google-confirmed map pins have coordinates but no stable Place ID.
  // For these, the browser must echo the *saved* point, then the pricing
  // service independently verifies that marker against the geocoder.
  const markerMatches = requested.latitude != null && requested.longitude != null
    && saved.latitude != null && saved.longitude != null
    && Number.isFinite(requested.latitude) && Number.isFinite(requested.longitude)
    && Math.abs(requested.latitude - Number(saved.latitude)) <= 0.00001
    && Math.abs(requested.longitude - Number(saved.longitude)) <= 0.00001;
  if (
    (saved.placeId
      ? requested.placeId !== saved.placeId
      : Boolean(requested.placeId) || !markerMatches) ||
    normalized(requested.line1) !== normalized(saved.line1) ||
    normalized(requested.line2) !== normalized(saved.line2) ||
    normalized(requested.suburb?.trim() || requested.line2) !== normalized(saved.suburb?.trim() || saved.line2) ||
    normalized(requested.city) !== normalized(saved.city) ||
    normalized(requested.province) !== normalized(saved.province) ||
    normalized(requested.postalCode) !== normalized(saved.postalCode)
  ) {
    throw new PlatformError(
      "STORE_PICKUP_CHANGED",
      "The collection location must match the store's saved, verified pickup address. Update the store pickup or request a new quote.",
      409,
    );
  }
}
