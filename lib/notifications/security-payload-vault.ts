import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { NotificationPolicyError } from "./contracts";

const PREFIX = "nsecurity:v2:";
const MAX_BYTES = 16_384;

export function securityPayloadKey(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY ?? "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw) throw new NotificationPolicyError("NOTIFICATION_SECURITY_ENCRYPTION_UNAVAILABLE");
  return key;
}

export function canonicalSecurityValues(values: Record<string, unknown>): string {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new NotificationPolicyError("INVALID_SECURITY_NOTIFICATION_VALUES");
  const entries = Object.keys(values).sort().map((key) => {
    const value = values[key];
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || !(typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean" || value === null)) throw new NotificationPolicyError("INVALID_SECURITY_NOTIFICATION_VALUES");
    return [key, value];
  });
  const serialized = JSON.stringify(Object.fromEntries(entries));
  if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES) throw new NotificationPolicyError("INVALID_SECURITY_NOTIFICATION_VALUES");
  return serialized;
}

/** Bind the ciphertext to its immutable delivery operation; secrets never enter public evidence. */
export function sealSecurityPayload(values: Record<string, unknown>, operationId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", securityPayloadKey(), iv);
  cipher.setAAD(Buffer.from(operationId, "utf8"));
  const body = Buffer.concat([cipher.update(canonicalSecurityValues(values), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function openSecurityPayload(encryptedPayload: string, operationId: string): Record<string, unknown> {
  try {
    const isLegacy = encryptedPayload.startsWith("nsecurity:v1:");
    if (!isLegacy && !encryptedPayload.startsWith(PREFIX)) throw new Error("Invalid envelope");
    const body = Buffer.from(encryptedPayload.slice(PREFIX.length), "base64url");
    if (body.length < 29 || body.length > MAX_BYTES + 28) throw new Error("Invalid envelope");
    const decipher = createDecipheriv("aes-256-gcm", securityPayloadKey(), body.subarray(0, 12));
    if (!isLegacy) decipher.setAAD(Buffer.from(operationId, "utf8"));
    decipher.setAuthTag(body.subarray(12, 28));
    const values: Record<string, unknown> = JSON.parse(Buffer.concat([decipher.update(body.subarray(28)), decipher.final()]).toString("utf8"));
    canonicalSecurityValues(values);
    return values;
  } catch {
    throw new NotificationPolicyError("NOTIFICATION_SECURITY_PAYLOAD_INVALID");
  }
}
