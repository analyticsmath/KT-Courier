/**
 * A controlled activation applies sender OTP to newly booked parcel shipments.
 * Orders already in progress before the activation instant remain on their
 * original custody contract. Missing or malformed activation is never guessed.
 */
export function requiresSenderPickupOtp(
  createdAt: Date,
  settings: Readonly<{ enabled?: string; effectiveFrom?: string }> = {
    enabled: process.env.PICKUP_SENDER_OTP_REQUIRED,
    effectiveFrom: process.env.PICKUP_SENDER_OTP_REQUIRED_SINCE,
  },
): boolean {
  if (settings.enabled !== "true" || !settings.effectiveFrom) return false;
  const from = new Date(settings.effectiveFrom);
  if (Number.isNaN(from.getTime()) || Number.isNaN(createdAt.getTime())) return false;
  return createdAt >= from;
}
