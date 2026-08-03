export const DELIVERY_OTP_POLICY = Object.freeze({
  expiresInMinutes: 30,
  maxAttempts: 5,
  requiresOtpForDriverCompletion: true,
});

export function isOtpLocked(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts;
}
