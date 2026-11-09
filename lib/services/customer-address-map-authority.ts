import type { SavedAddressUpdateInput } from "@/lib/validation/address-book";

type LocationTextField = "line1" | "line2" | "city" | "province" | "postalCode" | "country" | "formattedAddress";

export type ExistingCustomerAddressLocation = Readonly<{
  line1: string;
  line2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  formattedAddress: string | null;
  placeId: string | null;
  latitude: number | { toString(): string } | null;
  longitude: number | { toString(): string } | null;
}>;

const ADDRESS_TEXT_FIELDS: readonly LocationTextField[] = [
  "line1", "line2", "city", "province", "postalCode", "country", "formattedAddress",
];

function coordinateChanged(
  current: number | { toString(): string } | null,
  incoming: number | null | undefined,
): boolean {
  if (incoming === undefined) return false;
  if (incoming === null) return current !== null;
  return current === null || Number(current.toString()) !== incoming;
}

/**
 * A customer may edit contact details without losing a previously confirmed
 * map point. But changing the physical address or map point must never join
 * a new address to an old placeId/latitude/longitude.
 *
 * An explicitly supplied, complete map selection may be retained for display.
 * It is NOT delivery eligibility or payment authorization: the booking and
 * checkout endpoints independently validate the live provider route.
 */
export function staleCustomerSavedAddressPinReset(
  existing: ExistingCustomerAddressLocation,
  input: SavedAddressUpdateInput,
): { placeId: null; latitude: null; longitude: null; formattedAddress?: null } | null {
  const textChanged = ADDRESS_TEXT_FIELDS.some(
    (field) => input[field] !== undefined && input[field] !== existing[field],
  );
  const pointChanged =
    (input.placeId !== undefined && input.placeId !== existing.placeId)
    || coordinateChanged(existing.latitude, input.latitude)
    || coordinateChanged(existing.longitude, input.longitude);

  if (!textChanged && !pointChanged) return null;

  const completeNewPin =
    typeof input.placeId === "string"
    && /^[A-Za-z0-9_.:-]{5,200}$/.test(input.placeId)
    && typeof input.latitude === "number"
    && Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90
    && typeof input.longitude === "number"
    && Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180
    && (input.latitude !== 0 || input.longitude !== 0);
  if (completeNewPin) return null;

  return {
    placeId: null,
    latitude: null,
    longitude: null,
    ...(textChanged && input.formattedAddress === undefined ? { formattedAddress: null } : {}),
  };
}
