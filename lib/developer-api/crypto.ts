import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { DeveloperApiError } from "./contracts";

const CREDENTIAL_PATTERN = /^kt_(test|live)_[A-Za-z0-9_-]{43,}$/;

function hmacKey(): string {
  const value = process.env.DEVELOPER_API_CREDENTIAL_HMAC_KEY;
  if (!value || value.length < 32) throw new DeveloperApiError("DEVELOPER_API_CREDENTIAL_HASH_UNAVAILABLE", 503, "Credential verification is unavailable.");
  return value;
}

function encryptionKey(): Buffer {
  const value = process.env.DEVELOPER_WEBHOOK_ENCRYPTION_KEY;
  const key = value ? Buffer.from(value, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new DeveloperApiError("DEVELOPER_WEBHOOK_SECRET_ENCRYPTION_UNAVAILABLE", 503, "Webhook secret management is unavailable.");
  return key;
}

export function generateCredential(environment: "TEST" | "LIVE"): string {
  return `kt_${environment.toLowerCase()}_${randomBytes(40).toString("base64url")}`;
}

export function validateCredentialFormat(raw: string): "TEST" | "LIVE" | null {
  const match = CREDENTIAL_PATTERN.exec(raw);
  return match ? (match[1] === "test" ? "TEST" : "LIVE") : null;
}

export function credentialFingerprint(raw: string): string { return createHash("sha256").update(raw).digest("hex"); }
export function credentialHash(raw: string): string { return createHmac("sha256", hmacKey()).update(raw).digest("hex"); }
export function verifyCredentialHash(raw: string, expected: string): boolean {
  const actual = credentialHash(raw);
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
export function maskCredential(raw: string): string { return `${raw.slice(0, 11)}••••${raw.slice(-4)}`; }
export function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
export function opaqueReference(prefix: string): string { return `${prefix}_${randomBytes(18).toString("base64url")}`; }

export function encryptWebhookSecret(secret: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `dwhsec:v1:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
}
export function decryptWebhookSecret(value: string): string {
  const encoded = value.startsWith("dwhsec:v1:") ? value.slice(9) : "";
  const body = Buffer.from(encoded, "base64url");
  if (body.length < 29) throw new DeveloperApiError("DEVELOPER_WEBHOOK_SECRET_INVALID", 500);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), body.subarray(0, 12));
  decipher.setAuthTag(body.subarray(12, 28));
  return Buffer.concat([decipher.update(body.subarray(28)), decipher.final()]).toString("utf8");
}
export function generateWebhookSecret(): string { return `whsec_${randomBytes(32).toString("base64url")}`; }
export function maskSecret(secret: string): string { return `${secret.slice(0, 8)}••••${secret.slice(-4)}`; }
