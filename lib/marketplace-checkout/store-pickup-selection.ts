import { isSouthAfricanCountry } from "@/lib/validation/south-african-country";

export type StorePickupCoordinate = number | string | { toString(): string } | null | undefined;

export type StorePickupAddressCandidate = Readonly<{
  id?: string | null;
  storeId?: string | null;
  type?: string | null;
  isDefault?: boolean | null;
  line1?: string | null;
  line2?: string | null;
  suburb?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: StorePickupCoordinate;
  longitude?: StorePickupCoordinate;
  placeId?: string | null;
}>;

function hasCorePickupAddress(address: StorePickupAddressCandidate | null | undefined): boolean {
  return Boolean(
    address
    && (address.line1?.trim().length ?? 0) >= 3
    && (address.city?.trim().length ?? 0) >= 2
    && (address.province?.trim().length ?? 0) >= 2
    && isSouthAfricanCountry(address.country),
  );
}

function hasValidMapMarker(address: StorePickupAddressCandidate): boolean {
  if (address.latitude == null || address.longitude == null) return false;
  const latitude = Number(address.latitude);
  const longitude = Number(address.longitude);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180
    && (latitude !== 0 || longitude !== 0);
}

const UNIT_OR_BUILDING_LINE2_PATTERN =
  /^(?:unit|apt|apartment|suite|ste|shop|flat|room|rm|floor|fl|level|lvl|block|blk|building|bldg|stand|erf|lot|no\.?)(?:\s|$)|^[0-9]+[a-z]?$/i;

export function isUnitOrBuildingLine2(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  return UNIT_OR_BUILDING_LINE2_PATTERN.test(trimmed);
}

/**
 * Resolves the canonical suburb/area for a store pickup address without
 * conflating apartment/unit/building values in `line2` as a suburb.
 * Legacy pickups that stored a genuine suburb in `line2` (with empty `suburb`)
 * remain supported when `line2` is not a unit/building identifier.
 */
export function resolveStorePickupSuburb(
  address: Pick<StorePickupAddressCandidate, "suburb" | "line2"> | null | undefined,
): string | null {
  if (!address) return null;
  const canonical = address.suburb?.trim() ?? "";
  if (canonical.length > 0) return canonical;
  const legacyLine2 = address.line2?.trim() ?? "";
  if (!legacyLine2 || isUnitOrBuildingLine2(legacyLine2)) return null;
  return legacyLine2;
}

export function usesLegacyLine2Suburb(
  address: Pick<StorePickupAddressCandidate, "suburb" | "line2"> | null | undefined,
): boolean {
  if (!address) return false;
  const canonical = address.suburb?.trim() ?? "";
  if (canonical.length > 0) return false;
  return Boolean(resolveStorePickupSuburb(address));
}

/** Suburb/area, postal code and an explicit map marker are required for a merchant pickup. */
export function completeStorePickupAddress(address: StorePickupAddressCandidate | null | undefined): boolean {
  const resolvedSuburb = resolveStorePickupSuburb(address);
  return Boolean(
    hasCorePickupAddress(address)
    && (resolvedSuburb?.length ?? 0) >= 2
    && /^\d{4}$/.test(address?.postalCode?.trim() ?? "")
    && address
    && hasValidMapMarker(address),
  );
}

/** Returns the store's own pickup record even when incomplete, so it can be repaired. */
export function selectStorePickupCandidate<T extends StorePickupAddressCandidate>(
  storeId: string,
  defaultPickupAddress: T | null | undefined,
  savedAddresses: readonly T[],
): T | null {
  const candidates: T[] = [];
  if (defaultPickupAddress) candidates.push(defaultPickupAddress);
  for (const candidate of savedAddresses ?? []) candidates.push(candidate);

  const unique: T[] = [];
  for (const candidate of candidates) {
    if (candidate.storeId !== storeId || candidate.type !== "PICKUP") continue;
    const alreadyIncluded = unique.some((address) =>
      address.id && candidate.id ? address.id === candidate.id : address === candidate,
    );
    if (!alreadyIncluded) unique.push(candidate);
  }

  return unique.find(completeStorePickupAddress)
    ?? unique.find(hasCorePickupAddress)
    ?? unique.find((address) => address.id === defaultPickupAddress?.id)
    ?? unique[0]
    ?? null;
}

/** Only a fully configured pickup can authorize a marketplace quote. */
export function selectStorePickupAddress(
  storeId: string,
  defaultPickupAddress: StorePickupAddressCandidate | null | undefined,
  savedAddresses: readonly StorePickupAddressCandidate[],
): StorePickupAddressCandidate | null {
  const candidate = selectStorePickupCandidate(storeId, defaultPickupAddress, savedAddresses);
  return completeStorePickupAddress(candidate) ? candidate : null;
}

export function storePickupSetupState(
  pickupAddress: StorePickupAddressCandidate | null | undefined,
  legacyAddress: { line1?: string | null; city?: string | null; province?: string | null } | null | undefined,
): {
  setupRequired: boolean;
  legacyConfirmationRequired: boolean;
  savedPickupConfigured: boolean;
} {
  const savedPickupConfigured = completeStorePickupAddress(pickupAddress);
  const hasLegacyAddress = Boolean(
    legacyAddress?.line1?.trim()
    || legacyAddress?.city?.trim()
    || legacyAddress?.province?.trim(),
  );
  return {
    setupRequired: !savedPickupConfigured,
    legacyConfirmationRequired: !savedPickupConfigured && hasLegacyAddress,
    savedPickupConfigured,
  };
}
