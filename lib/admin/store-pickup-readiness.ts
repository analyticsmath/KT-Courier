/** Read-only evidence for the administrator's store setup queue.
 * A configured pickup is not proof that a delivery route or payment is available.
 */
export type StoreCollectionEvidence = Readonly<{
  postalCode?: string | null;
  latitude?: number | string | { toString(): string } | null;
  longitude?: number | string | { toString(): string } | null;
}>;

export type StoreCollectionEvidenceSummary = Readonly<{
  checkoutPickupConfigured: boolean;
  missing: readonly string[];
}>;

function mappedCoordinate(value: StoreCollectionEvidence["latitude"], min: number, max: number): boolean {
  if (value == null || String(value).trim() === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

export function describeStoreCollectionEvidence(
  selectedPickup: StoreCollectionEvidence | null | undefined,
): StoreCollectionEvidenceSummary {
  if (!selectedPickup) {
    return { checkoutPickupConfigured: false, missing: ["Saved collection address missing"] };
  }
  const missing: string[] = [];
  if (!/^\d{4}$/.test(selectedPickup.postalCode?.trim() ?? "")) {
    missing.push("Postal code missing");
  }
  if (!mappedCoordinate(selectedPickup.latitude, -90, 90)
    || !mappedCoordinate(selectedPickup.longitude, -180, 180)
    || (Number(selectedPickup.latitude) === 0 && Number(selectedPickup.longitude) === 0)) {
    missing.push("Map coordinates missing");
  }
  return { checkoutPickupConfigured: true, missing };
}
