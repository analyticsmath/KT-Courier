import crypto from "node:crypto";
import { hashToken } from "./tokens";

export const OTP_EXPIRY_MINUTES = 15;

function otpHmacKey(
  env: Record<string, string | undefined> = process.env,
): Buffer | null {
  const raw = env.AUTH_OTP_HMAC_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw) {
    throw new Error("AUTH_OTP_HMAC_KEY must be a canonical 32-byte base64 key.");
  }
  return key;
}

export function otpHmacKeyAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  try {
    return otpHmacKey(env) !== null;
  } catch {
    return false;
  }
}

export function generateOtpCode(): string {
  const val = crypto.randomInt(0, 1_000_000);
  return val.toString().padStart(6, "0");
}

/**
 * New OTPs are server-keyed so a database-only compromise cannot cheaply
 * brute-force the six-digit code space offline.
 */
export function hashOtp(
  code: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const key = otpHmacKey(env);
  if (!key) {
    if (env.NODE_ENV === "production") {
      throw new Error("AUTH_OTP_HMAC_KEY is required in production.");
    }
    return hashToken(code);
  }
  return crypto.createHmac("sha256", key).update(code).digest("hex");
}

/**
 * Temporary backward compatibility for OTPs created before keyed hashing was
 * enabled. New codes always use hashOtp().
 */
export function otpHashCandidates(
  code: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const keyed = hashOtp(code, env);
  const legacy = hashToken(code);
  return keyed === legacy ? [keyed] : [keyed, legacy];
}

export function otpExpiresAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + OTP_EXPIRY_MINUTES);
  return d;
}
