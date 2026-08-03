import { PaymentError } from "./errors";

export type SafeProviderJson = null | boolean | string | number | SafeProviderJson[] | { [key: string]: SafeProviderJson };

const SENSITIVE_KEY = /(?:secret|token|password|authorization|signature|merchant[_-]?key|private[_-]?key|card|cvv|cvc|bank[_-]?account|cookie|session|passphrase)/i;
const MAX_DEPTH = 5;
const MAX_KEYS = 64;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 2_048;
const MAX_BYTES = 16_384;

function invalid(message: string): never {
  throw new PaymentError("PAYMENT_METADATA_INVALID", message);
}

function sanitize(value: unknown, depth: number, state: { keys: number }): SafeProviderJson {
  if (depth > MAX_DEPTH) invalid("Provider snapshot exceeds the maximum nesting depth.");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalid("Provider snapshot contains a non-finite number.");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) invalid("Provider snapshot contains too many array entries.");
    return value.map((entry) => sanitize(entry, depth + 1, state));
  }
  if (typeof value !== "object") invalid("Provider snapshot contains a non-JSON value.");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid("Provider snapshot must contain plain JSON objects.");

  const output: Record<string, SafeProviderJson> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (!key.trim()) invalid("Provider snapshot contains an empty key.");
    state.keys += 1;
    if (state.keys > MAX_KEYS) invalid("Provider snapshot contains too many keys.");
    output[key] = SENSITIVE_KEY.test(key)
      ? "[REDACTED]"
      : sanitize((value as Record<string, unknown>)[key], depth + 1, state);
  }
  return output;
}

export function sanitizeProviderSnapshot(value: unknown): Readonly<Record<string, SafeProviderJson>> | undefined {
  if (value === undefined) return undefined;
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    invalid("Provider snapshot must be a JSON object.");
  }
  const result = sanitize(value, 0, { keys: 0 }) as Record<string, SafeProviderJson>;
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_BYTES) {
    invalid("Provider snapshot exceeds the maximum serialized size.");
  }
  return Object.freeze(result);
}

export function providerSnapshotContainsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(providerSnapshotContainsSensitiveKey);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, entry]) => SENSITIVE_KEY.test(key) || providerSnapshotContainsSensitiveKey(entry),
  );
}

