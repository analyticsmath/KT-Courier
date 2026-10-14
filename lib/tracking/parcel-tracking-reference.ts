/** Compact, case-insensitive KT parcel reference. Do not allow arbitrary IDs or URLs. */
export function normalizeParcelTrackingReference(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  // KT-YYYY-000000 (normal) or KT-YYYY-XXXXXXXX (collision fallback).
  return /^KT-\d{4}-[0-9A-Z]{6,8}$/.test(normalized) ? normalized : null;
}
