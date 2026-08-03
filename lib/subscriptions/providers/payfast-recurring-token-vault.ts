import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { SubscriptionError } from "@/lib/subscriptions/errors";

const ENVELOPE_PREFIX = "pfrec:v1:";

export type PayfastRecurringTokenVault = Readonly<{
  encrypt(token: string): Readonly<{ encrypted: string; fingerprint: string }>;
  decrypt(encrypted: string): string;
  fingerprint(token: string): string;
}>;

function exactToken(token: string): string {
  if (!/^[A-Za-z0-9_.:-]{8,512}$/.test(token)) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "Provider recurring token is malformed.");
  return token;
}

function keyFromEnvironment(source: Readonly<Record<string, string | undefined>>): Buffer | null {
  const raw = source.PAYFAST_SUBSCRIPTION_TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length > 128 || /\s/.test(raw)) return null;
  try {
    const decoded = Buffer.from(raw, "base64");
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

export function createPayfastRecurringTokenVault(key: Buffer): PayfastRecurringTokenVault {
  if (key.length !== 32) throw new SubscriptionError("PROVIDER_TOKEN_STORAGE_UNAVAILABLE", "Provider recurring token encryption key is unavailable.");
  const fingerprint = (token: string) => createHash("sha256").update(exactToken(token), "utf8").digest("hex");
  return Object.freeze({
    fingerprint,
    encrypt(token: string) {
      const clean = exactToken(token);
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return Object.freeze({ encrypted: `${ENVELOPE_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`, fingerprint: fingerprint(clean) });
    },
    decrypt(encrypted: string) {
      if (!encrypted.startsWith(ENVELOPE_PREFIX)) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "Provider token envelope is invalid.");
      const payload = Buffer.from(encrypted.slice(ENVELOPE_PREFIX.length), "base64url");
      if (payload.length < 29) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "Provider token envelope is invalid.");
      const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
      decipher.setAuthTag(payload.subarray(12, 28));
      return exactToken(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8"));
    },
  });
}

/** There is no environment-variable bypass: an absent approved key blocks token persistence. */
export function resolvePayfastRecurringTokenVault(source: Readonly<Record<string, string | undefined>> = process.env): PayfastRecurringTokenVault | null {
  const key = keyFromEnvironment(source);
  return key ? createPayfastRecurringTokenVault(key) : null;
}

export function requirePayfastRecurringTokenVault(source: Readonly<Record<string, string | undefined>> = process.env): PayfastRecurringTokenVault {
  const vault = resolvePayfastRecurringTokenVault(source);
  if (!vault) throw new SubscriptionError("PROVIDER_TOKEN_STORAGE_UNAVAILABLE", "PROVIDER_TOKEN_STORAGE_UNAVAILABLE: provider recurring authorization is blocked because approved token storage is unavailable.");
  return vault;
}
