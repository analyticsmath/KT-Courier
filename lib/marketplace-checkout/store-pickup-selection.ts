import { isSouthAfricanCountry } from "@/lib/validation/south-african-country";

export type StorePickupCoordinate = number | string | { toString(): string } | null | undefined;

export type StorePickupAddressCandidate = Readonly<{
  id?: string | null;
  storeId?: string | null;
  type?: string | null;
  isDefault?: boolean | null;
  line1?: string | null;
  line2?: string | null;
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

/** Suburb/area, postal code and an explicit map marker are required for a merchant pickup. */
export function completeStorePickupAddress(address: StorePickupAddressCandidate | null | undefined): boolean {
  return Boolean(
    hasCorePickupAddress(address)
    && (address?.line2?.trim().length ?? 0) >= 2
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
