import type { StorePickupAddressCandidate } from "@/lib/marketplace-checkout/store-pickup-selection";

export type StoreCollectionEvidenceSummary = Readonly<{
  checkoutPickupConfigured: boolean;
  missing: readonly string[];
}>;

function validCoordinatePair(address: StorePickupAddressCandidate): boolean {
  if (address.latitude == null || address.longitude == null) return false;
  const latitude = Number(address.latitude);
  const longitude = Number(address.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180
    && (latitude !== 0 || longitude !== 0);
}

/** Evidence only: this does not establish delivery coverage or a buyer route. */
export function describeStoreCollectionEvidence(
  pickup: StorePickupAddressCandidate | null | undefined,
): StoreCollectionEvidenceSummary {
  if (!pickup) return { checkoutPickupConfigured: false, missing: ["Saved collection address missing"] };
  const missing: string[] = [];
  if ((pickup.line1?.trim().length ?? 0) < 3) missing.push("Street address missing");
  if ((pickup.line2?.trim().length ?? 0) < 2) missing.push("Suburb / area missing");
  if ((pickup.city?.trim().length ?? 0) < 2) missing.push("City missing");
  if ((pickup.province?.trim().length ?? 0) < 2) missing.push("Province missing");
  if (pickup.country?.trim().toLowerCase() !== "south africa") missing.push("Country not supported");
  if (!/^\d{4}$/.test(pickup.postalCode?.trim() ?? "")) missing.push("Postal code missing");
  if (!validCoordinatePair(pickup)) missing.push("Map coordinates missing");
  return { checkoutPickupConfigured: missing.length === 0, missing };
}
