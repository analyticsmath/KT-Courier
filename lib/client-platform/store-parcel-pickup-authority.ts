import { PlatformError } from "./contracts";
import { completeStorePickupAddress, type StorePickupAddressCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";

type QuotePickup = Readonly<{ line1?: string | null; line2?: string | null; city?: string | null; province?: string | null; postalCode?: string | null; placeId?: string | null }>;

/** A merchant outbound parcel must collect at its saved, mapped, store-owned
 * collection location, resolved by getStorePickupAddressForStore(storeId).
 * A quote may not be redirected to an unrelated address.
 * Pickup certification for marketplace go-Live remains an independent gate. */
export function assertStoreParcelPickupMatches(
  requested: QuotePickup,
  saved: StorePickupAddressCandidate | null | undefined,
): void {
  if (!completeStorePickupAddress(saved) || !saved?.placeId || saved.type !== "PICKUP") {
    throw new PlatformError(
      "STORE_PICKUP_NOT_CONFIGURED",
      "Add and verify the store collection address, suburb, postal code and map pin before requesting a courier.",
      409,
    );
  }
  const normalized = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (
    !requested.placeId ||
    requested.placeId !== saved.placeId ||
    normalized(requested.line1) !== normalized(saved.line1) ||
    normalized(requested.line2) !== normalized(saved.line2) ||
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
