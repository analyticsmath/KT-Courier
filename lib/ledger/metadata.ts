import {
  LEDGER_MAX_METADATA_BYTES,
  LEDGER_MAX_METADATA_DEPTH,
  LEDGER_MAX_METADATA_KEYS,
} from "./config";
import { LedgerError } from "./errors";
import type { LedgerJsonValue, SafeLedgerMetadata } from "./types";

const SENSITIVE_KEY = /(?:password|passcode|token|secret|authorization|cookie|session|otp|one.?time|cvv|cvc|pin|card.?number|bank.?details|bank.?account|routing.?number|private.?note|request.?body)/i;

function invalidMetadata(message: string): never {
  throw new LedgerError("LEDGER_METADATA_INVALID", message);
}

function normalizeValue(value: unknown, depth: number, state: { keys: number }): LedgerJsonValue {
  if (depth > LEDGER_MAX_METADATA_DEPTH) invalidMetadata("Ledger metadata exceeds the maximum nesting depth.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, depth + 1, state));
  }

  if (typeof value !== "object") {
    invalidMetadata("Ledger metadata may contain only JSON strings, booleans, nulls, arrays, and objects.");
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalidMetadata("Ledger metadata must be a plain JSON object.");
  }

  const normalized: Record<string, LedgerJsonValue> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (!key.trim() || SENSITIVE_KEY.test(key)) {
      invalidMetadata("Ledger metadata contains a prohibited or empty key.");
    }
    state.keys += 1;
    if (state.keys > LEDGER_MAX_METADATA_KEYS) invalidMetadata("Ledger metadata contains too many keys.");
    normalized[key] = normalizeValue((value as Record<string, unknown>)[key], depth + 1, state);
  }
  return normalized;
}

export function sanitizeLedgerMetadata(value: unknown): SafeLedgerMetadata | undefined {
  if (value === undefined) return undefined;
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    invalidMetadata("Ledger metadata must be a JSON object.");
  }

  const normalized = normalizeValue(value, 0, { keys: 0 });
  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, "utf8") > LEDGER_MAX_METADATA_BYTES) {
    invalidMetadata("Ledger metadata exceeds the maximum serialized size.");
  }
  return Object.freeze(normalized as Record<string, LedgerJsonValue>);
}

