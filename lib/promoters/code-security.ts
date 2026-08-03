import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PromoterError } from "./errors";

const CODE = /^[A-Z2-9]{8,24}$/;
const TOKEN_VERSION = "p25";
function secret(): string {
  const value = process.env.PROMOTER_REFERRAL_HMAC_SECRET;
  if (!value || value.length < 32) throw new PromoterError("PROMOTER_TOKEN_INVALID", "Referral token signing is not configured.");
  return value;
}
export function normalizePromoterCode(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!CODE.test(normalized)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Referral code format is invalid.");
  return normalized;
}
export function hmacPromoterCode(rawCode: string): string { return createHmac("sha256", secret()).update(normalizePromoterCode(rawCode)).digest("hex"); }
export function fingerprintPromoterCode(rawCode: string): string { return createHash("sha256").update(normalizePromoterCode(rawCode)).digest("hex"); }
export function maskPromoterCode(rawCode: string): string { const code = normalizePromoterCode(rawCode); return `${code.slice(0, 3)}…${code.slice(-3)}`; }
export function generatePromoterCode(): string { return randomBytes(12).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 16); }

export type PromoterReferralToken = Readonly<{ touchReference: string; programVersionReference: string; enrollmentReference: string; destinationType: string; issuedAt: string; expiresAt: string; nonce: string }>;
export function signPromoterReferralToken(payload: Omit<PromoterReferralToken, "issuedAt" | "expiresAt" | "nonce">, ttlSeconds = 900): string {
  const now = new Date(); const body: PromoterReferralToken = { ...payload, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(), nonce: randomBytes(16).toString("hex") };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url"); const signature = createHmac("sha256", secret()).update(`${TOKEN_VERSION}.${encoded}`).digest("base64url");
  return `${TOKEN_VERSION}.${encoded}.${signature}`;
}
export function verifyPromoterReferralToken(token: string, now = new Date()): PromoterReferralToken {
  const [version, encoded, signature, extra] = token.split("."); if (version !== TOKEN_VERSION || !encoded || !signature || extra) throw new PromoterError("PROMOTER_TOKEN_INVALID", "Referral token is invalid.");
  const expected = createHmac("sha256", secret()).update(`${version}.${encoded}`).digest("base64url");
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new PromoterError("PROMOTER_TOKEN_INVALID", "Referral token is invalid.");
  let payload: PromoterReferralToken; try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw new PromoterError("PROMOTER_TOKEN_INVALID", "Referral token is invalid."); }
  if (!payload.nonce || !payload.touchReference || !payload.programVersionReference || !payload.enrollmentReference || Number.isNaN(Date.parse(payload.expiresAt))) throw new PromoterError("PROMOTER_TOKEN_INVALID", "Referral token is invalid.");
  if (new Date(payload.expiresAt) <= now) throw new PromoterError("PROMOTER_TOKEN_EXPIRED", "Referral token has expired.");
  return Object.freeze(payload);
}
