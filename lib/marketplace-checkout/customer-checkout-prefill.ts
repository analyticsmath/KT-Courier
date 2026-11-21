import { isSouthAfricanCountry } from "@/lib/validation/south-african-country";

/** Read-only presentation of the authenticated customer's existing address
 * book. This does not authorize geocoding, delivery coverage or a charge.
 * The checkout server re-verifies the selected address and route on submit.
 */
export type CustomerCheckoutSavedAddress = Readonly<{
  id: string;
  type: string;
  label: string | null;
  isDefault: boolean;
  contactName: string | null;
  contactPhone: string | null;
  line1: string;
  line2: string | null;
  suburb?: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  accessNotes: string | null;
  formattedAddress: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
}>;

export type CheckoutAddressPrefill = Readonly<{
  line1: string;
  line2: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  instructions: string;
  needsSuburbConfirmation: boolean;
  needsMapLocationConfirmation: boolean;
  hasSavedCoordinatePinWithoutPlaceId?: boolean;
  mapped: {
    formattedAddress: string;
    placeId: string | null;
    line1: string;
    line2: string | null;
    suburb: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}>;

export function selectableCustomerAddresses(
  addresses: readonly CustomerCheckoutSavedAddress[],
): CustomerCheckoutSavedAddress[] {
  return addresses
    .filter((address) =>
      address.id.trim().length > 0
      && address.line1.trim().length >= 3
      && isSouthAfricanCountry(address.country))
    .sort((a, b) => {
      const priority = (address: CustomerCheckoutSavedAddress) =>
        (address.type === "CUSTOMER" || address.type === "DROPOFF" ? 4 : 0)
        + (address.isDefault ? 2 : 0);
      return priority(b) - priority(a);
    });
}

export function customerCheckoutAddressPrefill(
  address: CustomerCheckoutSavedAddress,
): CheckoutAddressPrefill {
  const lat = address.latitude;
  const lng = address.longitude;
  // Never infer suburb from unit/building (line2); legacy addresses without a
  // trusted suburb or map pin prompt for confirmation in checkout instead.
  const suburb = address.suburb?.trim() ?? "";
  const rawPlaceId = address.placeId?.trim() ?? "";
  const hasValidPlaceId = rawPlaceId.length > 0 && /^[A-Za-z0-9_.:-]{5,240}$/.test(rawPlaceId);
  const hasMalformedPlaceId = rawPlaceId.length > 0 && !hasValidPlaceId;
  const hasValidCoordinates =
    typeof lat === "number" && typeof lng === "number"
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && (lat !== 0 || lng !== 0);
  // Stored data alone never authorizes a route: checkout calls the configured
  // geocoding/coverage providers again after the customer submits. When a
  // saved customer address has valid coordinates without a Place ID, preserve
  // those saved coordinates in trusted account context so checkout can verify
  // the marker on submit rather than silently blanking the saved pin.
  const mapped = hasValidCoordinates && !hasMalformedPlaceId
      ? {
          formattedAddress: address.formattedAddress?.trim()
            || [address.line1, suburb || null, address.city, address.province, address.postalCode, "South Africa"].filter(Boolean).join(", "),
          placeId: hasValidPlaceId ? rawPlaceId : null,
          line1: address.line1,
          line2: address.line2,
          suburb: suburb || null,
          city: address.city,
          province: address.province,
          postalCode: address.postalCode,
          country: "South Africa",
          latitude: lat,
          longitude: lng,
        }
      : null;
  return {
    line1: address.line1,
    line2: address.line2 ?? "",
    suburb,
    city: address.city ?? "",
    province: address.province ?? "Gauteng",
    postalCode: address.postalCode ?? "",
    instructions: address.accessNotes ?? "",
    needsSuburbConfirmation: suburb.length === 0,
    needsMapLocationConfirmation: mapped === null,
    hasSavedCoordinatePinWithoutPlaceId: Boolean(mapped && !hasValidPlaceId),
    mapped,
  };
}
