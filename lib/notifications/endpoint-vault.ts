import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { NotificationPolicyError } from "./contracts";

function keyFromEnvironment(): Buffer | null {
  const value = process.env.NOTIFICATION_ENDPOINT_ENCRYPTION_KEY;
  if (!value || value.length > 128 || /\s/.test(value)) return null;
  const key = Buffer.from(value, "base64");
  return key.length === 32 ? key : null;
}

export function encryptNotificationEndpoint(rawEndpoint: string): { encrypted: string; fingerprint: string; masked: string } {
  if (rawEndpoint.length < 16 || rawEndpoint.length > 4096) throw new NotificationPolicyError("INVALID_NOTIFICATION_ENDPOINT");
  const key = keyFromEnvironment();
  if (!key) throw new NotificationPolicyError("NOTIFICATION_ENDPOINT_ENCRYPTION_UNAVAILABLE");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(rawEndpoint, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: `nendpoint:v1:${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`, fingerprint: createHash("sha256").update(rawEndpoint).digest("hex"), masked: `endpoint••••${createHash("sha256").update(rawEndpoint).digest("hex").slice(-6)}` };
}
