/** Only an explicitly saved, complete collection point may be described as
 * configured in the vendor dashboard. Business registration addresses are not
 * courier pickup authority. Coverage and checkout are checked separately.
 */
export type MerchantSavedPickup = Readonly<{
  line1?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}>;

export function isMerchantPickupEvidenceComplete(pickup: MerchantSavedPickup | null | undefined): boolean {
  if (!pickup || (pickup.line1?.trim().length ?? 0) < 3 || (pickup.city?.trim().length ?? 0) < 2 || (pickup.province?.trim().length ?? 0) < 2 || pickup.country?.trim().toLowerCase() !== "south africa") return false;
  if (!/^\d{4}$/.test(pickup.postalCode?.trim() ?? "")) return false;
  const latitude = Number(pickup.latitude);
  const longitude = Number(pickup.longitude);
  return pickup.latitude != null && pickup.longitude != null
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    && (latitude !== 0 || longitude !== 0);
}
