import { createHash } from "node:crypto";
import { payfastUrlEncode } from "@/lib/payments/providers/payfast/payfast-url-encoding";
import { RefundError } from "../../errors";

export type PayfastApiHeaders = Readonly<{
  "merchant-id": string;
  version: "v1";
  timestamp: string;
  signature: string;
}>;

type SignableMap = Readonly<Record<string, string | undefined>>;

function normalizeMap(target: Map<string, string>, values: SignableMap): void {
  for (const [rawKey, rawValue] of Object.entries(values)) {
    if (rawValue === undefined || rawValue === "") continue;
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(rawKey) || rawValue !== rawValue.trim() || /[\r\n\0]/.test(rawValue) || target.has(rawKey)) {
      throw new RefundError("REFUND_PROVIDER_NOT_READY", "Payfast API signature data is invalid.");
    }
    target.set(rawKey, rawValue);
  }
}

export function buildPayfastApiSignatureBase(input: Readonly<{
  headers: Omit<PayfastApiHeaders, "signature">;
  query?: SignableMap;
  body?: SignableMap;
  passphrase: string;
  /** Protocol-specific fields such as sandbox test switches that PayFast does
   * not include in its REST signature base. */
  excludedKeys?: readonly string[];
}>): string {
  if (!input.passphrase || input.passphrase !== input.passphrase.trim() || input.passphrase.length > 256 || /[\r\n\0]/.test(input.passphrase)) {
    throw new RefundError("REFUND_PROVIDER_NOT_READY", "Payfast API signature configuration is invalid.");
  }
  const values = new Map<string, string>();
  const excluded = new Set(input.excludedKeys ?? []);
  for (const key of excluded) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(key)) throw new RefundError("REFUND_PROVIDER_NOT_READY", "Payfast API signature exclusion data is invalid.");
  }
  const include = (source: SignableMap) => Object.fromEntries(Object.entries(source).filter(([key]) => !excluded.has(key)));
  normalizeMap(values, include(input.headers));
  normalizeMap(values, include(input.query ?? {}));
  normalizeMap(values, include(input.body ?? {}));
  values.set("passphrase", input.passphrase);
  return [...values.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${payfastUrlEncode(value)}`)
    .join("&");
}

export function generatePayfastApiSignature(input: Parameters<typeof buildPayfastApiSignatureBase>[0]): string {
  return createHash("md5").update(buildPayfastApiSignatureBase(input), "utf8").digest("hex");
}

export function buildPayfastApiHeaders(input: Readonly<{
  merchantId: string;
  passphrase: string;
  timestamp: string;
  query?: SignableMap;
  body?: SignableMap;
}>): PayfastApiHeaders {
  const unsigned = Object.freeze({ "merchant-id": input.merchantId, version: "v1" as const, timestamp: input.timestamp });
  const signature = generatePayfastApiSignature({ headers: unsigned, query: input.query, body: input.body, passphrase: input.passphrase });
  return Object.freeze({ ...unsigned, signature });
}
