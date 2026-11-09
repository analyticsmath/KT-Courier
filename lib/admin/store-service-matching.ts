/** Read-only service-area matching for merchant collection preflight.
 * A case/whitespace difference in a canonical province name cannot hide a
 * correctly configured Gauteng service. This is NOT proof of a road route,
 * delivery capacity or a reviewed checkout receipt.
 */
export function isActiveDeliveryServiceForPickup(
  service: Readonly<{ active: boolean; provinces: readonly string[]; regionIds: readonly string[] }>,
  pickupProvince: string | null | undefined,
  pickupRegionId: string | null | undefined,
): boolean {
  const normalise = (value: string) => value.trim().replace(/\\s+/g, " ").toLocaleLowerCase("en-ZA");
  const province = normalise(pickupProvince ?? "");
  if (!service.active || !province || !pickupRegionId) return false;
  return service.provinces.some(configured => normalise(configured) === province)
    && (service.regionIds.length === 0 || service.regionIds.includes(pickupRegionId));
}
