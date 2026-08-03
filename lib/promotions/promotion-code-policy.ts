import crypto from "crypto";

export function normalizePromotionCode(code: string): string {
  return code.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
}

export function computeCodeFingerprint(normalizedCode: string): string {
  const hash = crypto.createHash("sha256").update(normalizedCode).digest("hex");
  return hash.substring(0, 8);
}

export function maskPromotionCode(normalizedCode: string): string {
  if (normalizedCode.length <= 4) return "****";
  const first2 = normalizedCode.substring(0, 2);
  const last2 = normalizedCode.substring(normalizedCode.length - 2);
  return `${first2}****${last2}`;
}

export function computeCodeHmac(normalizedCode: string, hmacKey: string): string {
  return crypto.createHmac("sha256", hmacKey).update(normalizedCode).digest("hex");
}

export interface RateLimitEvidence {
  timestamp: Date;
  attemptCount: number;
  sourceIpHash: string;
}

export function checkCodeBruteForceProtection(attemptsInLast15Mins: number): void {
  if (attemptsInLast15Mins >= 5) {
    throw new Error("Too many promotion code attempts. Please try again in 15 minutes.");
  }
}
