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
  city: string;
  province: string;
  postalCode: string;
  instructions: string;
  mapped: {
    formattedAddress: string;
    placeId: string | null;
    line1: string;
    line2: string | null;
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
  // Stored data alone never authorizes a route: checkout calls the configured
  // geocoding/coverage providers again after the customer submits.
  const mapped = address.placeId
    && /^[A-Za-z0-9_.:-]{5,240}$/.test(address.placeId)
    && typeof lat === "number" && typeof lng === "number"
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && (lat !== 0 || lng !== 0)
      ? {
          formattedAddress: address.formattedAddress?.trim()
            || [address.line1, address.city, address.province, address.postalCode, "South Africa"].filter(Boolean).join(", "),
          placeId: address.placeId,
          line1: address.line1,
          line2: address.line2,
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
    city: address.city ?? "",
    province: address.province ?? "Gauteng",
    postalCode: address.postalCode ?? "",
    instructions: address.accessNotes ?? "",
    mapped,
  };
}
