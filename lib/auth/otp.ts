import crypto from "node:crypto";
import { hashToken } from "./tokens";

export const OTP_EXPIRY_MINUTES = 15;

export function generateOtpCode(): string {
  const val = crypto.randomInt(0, 999_999);
  return val.toString().padStart(6, "0");
}

export function hashOtp(code: string): string {
  return hashToken(code);
}

export function otpExpiresAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + OTP_EXPIRY_MINUTES);
  return d;
}
