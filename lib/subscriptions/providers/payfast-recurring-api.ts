import { buildPayfastApiHeaders, generatePayfastApiSignature } from "@/lib/refunds/providers/payfast/payfast-api-signature";
import { payfastUrlEncode } from "@/lib/payments/providers/payfast/payfast-url-encoding";
import { SubscriptionError } from "@/lib/subscriptions/errors";

export const PAYFAST_RECURRING_API_ORIGIN = "https://api.payfast.co.za" as const;
export const PAYFAST_RECURRING_API_VERSION = "v1" as const;
export const PAYFAST_RECURRING_TIMEOUT_MS = 10_000 as const;
export const PAYFAST_RECURRING_MAX_RESPONSE_BYTES = 32_768 as const;

export type PayfastRecurringConfiguration = Readonly<{ merchantId: string; passphrase: string; apiOrigin: typeof PAYFAST_RECURRING_API_ORIGIN; apiVersion: typeof PAYFAST_RECURRING_API_VERSION }>;
export type PayfastRecurringApiRequest = Readonly<{ url: string; method: "GET" | "POST" | "PUT" | "DELETE"; headers: Readonly<Record<string, string>>; body?: string; safeRequest: Readonly<Record<string, string | boolean>> }>;

const SAFE_REFERENCE = /^[A-Za-z0-9_.:-]{1,160}$/;
const SAFE_OPERATION = /^[A-Za-z0-9_.:-]{1,160}$/;

function exact(value: string, name: string, pattern = SAFE_REFERENCE): string {
  if (!pattern.test(value)) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", `PayFast recurring ${name} is invalid.`);
  return value;
}

export function toPayfastZarCents(amount: string): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount)) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "PayFast recurring amount must be a positive two-decimal ZAR value.");
  const [whole, fractional = ""] = amount.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt((fractional + "00").slice(0, 2));
  if (cents <= BigInt(0) || cents > BigInt(9999999999)) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "PayFast recurring amount is out of bounds.");
  return cents.toString();
}

export function generatePayfastRecurringApiSignature(input: Readonly<{ merchantId: string; passphrase: string; timestamp: string; query?: Record<string, string | undefined>; body?: Record<string, string | undefined> }>): string {
  // Phase 15 owns the audited REST signature primitive; sandbox switches are
  // explicitly omitted from the provider signature base for recurring calls.
  return generatePayfastApiSignature({ headers: { "merchant-id": input.merchantId, version: "v1", timestamp: input.timestamp }, query: input.query, body: input.body, passphrase: input.passphrase, excludedKeys: ["sandbox", "testing"] });
}

function headers(configuration: PayfastRecurringConfiguration, timestamp: string, query: Record<string, string | undefined>, body: Record<string, string | undefined>) {
  const signature = generatePayfastRecurringApiSignature({ merchantId: configuration.merchantId, passphrase: configuration.passphrase, timestamp, query, body });
  const shared = buildPayfastApiHeaders({ merchantId: configuration.merchantId, passphrase: configuration.passphrase, timestamp, query, body });
  // `shared.signature` is intentionally ignored: recurring needs its explicit
  // sandbox exclusion policy above, while retaining Phase 15's header shape.
  void shared;
  return Object.freeze({ "merchant-id": configuration.merchantId, version: configuration.apiVersion, timestamp, signature, accept: "application/json", "content-type": "application/json" });
}

function endpoint(path: string): string {
  const url = new URL(path, PAYFAST_RECURRING_API_ORIGIN);
  if (url.protocol !== "https:" || url.origin !== PAYFAST_RECURRING_API_ORIGIN) throw new SubscriptionError("SUBSCRIPTION_PROVIDER_PROTOCOL_INVALID", "PayFast recurring endpoint must be pinned HTTPS.");
  return url.toString();
}

export function buildPayfastRecurringApiRequest(input: Readonly<{ configuration: PayfastRecurringConfiguration; timestamp: string; method: PayfastRecurringApiRequest["method"]; path: string; query?: Record<string, string | undefined>; body?: Record<string, string | undefined>; operationId: string }>): PayfastRecurringApiRequest {
  const query = input.query ?? {};
  const body = input.body ?? {};
  const operationId = exact(input.operationId, "operation id", SAFE_OPERATION);
  const qs = Object.entries(query).filter(([, value]) => value !== undefined && value !== "").sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encodeURIComponent(key)}=${payfastUrlEncode(value!)}`).join("&");
  const url = `${endpoint(input.path)}${qs ? `?${qs}` : ""}`;
  const bodyJson = input.method === "GET" || input.method === "DELETE" ? undefined : JSON.stringify(body);
  return Object.freeze({ url, method: input.method, headers: Object.freeze({ ...headers(input.configuration, input.timestamp, query, body), "idempotency-key": operationId }), ...(bodyJson ? { body: bodyJson } : {}), safeRequest: Object.freeze({ path: input.path, method: input.method, operationId, amountInCents: body.amount ?? "" }) });
}

export async function parseBoundedPayfastRecurringJson(response: Readonly<{ status: number; redirected: boolean; body: unknown }>): Promise<Readonly<{ status: number; body: Record<string, unknown> }>> {
  if (response.redirected) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "PayFast recurring API redirect is not permitted.", true);
  const source = typeof response.body === "string" ? response.body : JSON.stringify(response.body);
  if (source.length > PAYFAST_RECURRING_MAX_RESPONSE_BYTES) throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "PayFast recurring API response exceeded the safe limit.", true);
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not record");
    return Object.freeze({ status: response.status, body: parsed as Record<string, unknown> });
  } catch {
    throw new SubscriptionError("SUBSCRIPTION_RECONCILIATION_REQUIRED", "PayFast recurring API returned malformed JSON.", true);
  }
}
