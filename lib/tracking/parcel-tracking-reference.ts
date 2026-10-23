/** Compact, case-insensitive KT parcel reference. Do not allow arbitrary IDs or URLs. */
export function normalizeParcelTrackingReference(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  // KT-YYYY-000000 (normal) or KT-YYYY-XXXXXXXX (collision fallback).
  return /^KT-\d{4}-[0-9A-Z]{6,8}$/.test(normalized) ? normalized : null;
}

export type DeliveryTrackingReference =
  | Readonly<{ kind: "PARCEL"; reference: string }>
  | Readonly<{ kind: "MARKETPLACE"; reference: string }>;

export function parseDeliveryTrackingReference(value: string): DeliveryTrackingReference | null {
  const parcel = normalizeParcelTrackingReference(value);
  if (parcel) return { kind: "PARCEL", reference: parcel };
  const marketplace = value.trim();
  return /^morder_[0-9a-f]{32}$/.test(marketplace)
    ? { kind: "MARKETPLACE", reference: marketplace }
    : null;
}

/** Authenticated order ownership, not the reference, authorizes details. */
export function trackingLoginReturnUrl(lookup: DeliveryTrackingReference, storeWorkspace: boolean): string {
  const params = new URLSearchParams({ reference: lookup.reference });
  if (storeWorkspace && lookup.kind === "PARCEL") params.set("workspace", "store");
  return "/track?" + params.toString();
}
