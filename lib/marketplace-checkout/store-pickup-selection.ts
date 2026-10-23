/** Select only an explicitly configured and complete collection address owned by the store.
 * Imported business/default addresses must never silently become courier pickup stops.
 * An incomplete default cannot hide a valid saved pickup record.
 */
export type StorePickupCandidate = Readonly<{
  storeId?: string | null;
  type?: string | null;
  isDefault?: boolean | null;
  line1?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
}>;

export function completeStorePickupAddress(address: StorePickupCandidate | null | undefined): boolean {
  return Boolean(address
    && (address.line1?.trim().length ?? 0) >= 3
    && (address.city?.trim().length ?? 0) >= 2
    && (address.province?.trim().length ?? 0) >= 2
    && address.country?.trim().toLowerCase() === "south africa");
}

export function selectStorePickupAddress<T extends StorePickupCandidate>(
  storeId: string,
  defaultPickupAddress: T | null | undefined,
  savedAddresses: readonly T[] | null | undefined,
): T | null {
  const acceptable = (address: T) =>
    address.storeId === storeId &&
    address.type === "PICKUP" &&
    completeStorePickupAddress(address);

  if (defaultPickupAddress && acceptable(defaultPickupAddress)) {
    return defaultPickupAddress;
  }
  const candidates = (savedAddresses ?? []).filter(acceptable);
  return candidates.find((candidate) => candidate.isDefault === true) ?? candidates[0] ?? null;
}

/** A legacy business address is only a suggestion for the merchant's form.
 * It must not appear as a configured courier pickup until explicitly saved. */
export function storePickupSetupState(
  savedPickup: unknown | null | undefined,
  legacyBusiness: { line1?: string | null } | null | undefined,
) {
  const configured = completeStorePickupAddress(savedPickup as StorePickupCandidate | null | undefined);
  return {
    setupRequired: !configured,
    legacyConfirmationRequired: !configured && Boolean(legacyBusiness?.line1?.trim()),
    savedPickupConfigured: configured,
  };
}
