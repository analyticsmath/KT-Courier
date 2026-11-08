/** Compare verified South African phone numbers regardless of local vs +27
 * formatting. Unusable/short input must never be treated as an identity.
 * All other countries retain their full numeric country prefix.
 */
export function normalizeReferralPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (/^0027[1-9]\d{8}$/.test(digits)) return "0" + digits.slice(4);
  if (/^27[1-9]\d{8}$/.test(digits)) return "0" + digits.slice(2);
  if (/^0[1-9]\d{8}$/.test(digits)) return digits;
  return digits.length >= 10 && digits.length <= 15 ? "+" + digits : null;
}

export function sameReferralPhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalizedA = normalizeReferralPhone(a);
  const normalizedB = normalizeReferralPhone(b);
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}
