import { type NextRequest } from "next/server";

// ─── In-memory sliding window rate limiter ─────────────────────────────────────
// Single-instance only. For multi-instance deployments (Vercel serverless,
// multiple workers), replace the Map store with Redis/Upstash KV.
// See docs/deployment-readiness.md for upgrade path.

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

function prune(entry: RateLimitEntry, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

export interface RateLimitPolicy {
  max: number;
  windowMs: number;
  distributedRequired?: boolean;
}

// ─── Predefined configs ────────────────────────────────────────────────────────

export const RATE_LIMITS: Record<string, RateLimitPolicy> = {
  LOGIN: { max: 10, windowMs: 10 * 60 * 1000, distributedRequired: true },          // 10 per 10 min
  SIGNUP: { max: 5, windowMs: 60 * 60 * 1000, distributedRequired: true },           // 5 per hour
  FORGOT_PASSWORD: { max: 5, windowMs: 60 * 60 * 1000, distributedRequired: true },  // 5 per hour
  RESET_PASSWORD: { max: 10, windowMs: 15 * 60 * 1000, distributedRequired: true },   // 10 per 15 min
  RESEND_OTP: { max: 5, windowMs: 15 * 60 * 1000, distributedRequired: true },       // 5 per 15 min
  VERIFY_OTP: { max: 10, windowMs: 15 * 60 * 1000, distributedRequired: true },      // 10 per 15 min
  CONTACT: { max: 5, windowMs: 10 * 60 * 1000 },          // 5 per 10 min
  ORDER_ESTIMATE: { max: 30, windowMs: 10 * 60 * 1000 },  // 30 per 10 min
  ORDER_CREATE: { max: 20, windowMs: 10 * 60 * 1000 },    // 20 per 10 min
  PAYMENT_PREPARE: { max: 20, windowMs: 10 * 60 * 1000 },
  PAYMENT_CHECKOUT: { max: 20, windowMs: 10 * 60 * 1000 },
  PAYMENT_STATUS: { max: 120, windowMs: 10 * 60 * 1000 },
  ADDRESS_MUTATION: { max: 30, windowMs: 10 * 60 * 1000 }, // 30 per 10 min
  ADMIN_TEST_EMAIL: { max: 5, windowMs: 10 * 60 * 1000 }, // 5 per 10 min
  DISPATCH_ASSIGN:   { max: 30, windowMs: 10 * 60 * 1000 },
  DISPATCH_REASSIGN: { max: 20, windowMs: 10 * 60 * 1000 },
  DISPATCH_CANCEL:   { max: 20, windowMs: 10 * 60 * 1000 },
  DRIVER_ACCEPT:          { max: 20, windowMs: 10 * 60 * 1000 },
  DRIVER_REJECT:          { max: 20, windowMs: 10 * 60 * 1000 },
  PICKUP_START:           { max: 10, windowMs: 10 * 60 * 1000 },
  PICKUP_COMPLETE:        { max: 10, windowMs: 10 * 60 * 1000 },
  PICKUP_FAIL:            { max: 15, windowMs: 10 * 60 * 1000 },
  ADMIN_PICKUP_NOTE:      { max: 20, windowMs: 10 * 60 * 1000 },
  DELIVERY_START:         { max: 10, windowMs: 10 * 60 * 1000 },
  DELIVERY_OTP_SEND:      { max: 5,  windowMs: 15 * 60 * 1000 },
  DELIVERY_COMPLETE:      { max: 10, windowMs: 10 * 60 * 1000 },
  DELIVERY_ATTEMPTED:     { max: 15, windowMs: 10 * 60 * 1000 },
  DELIVERY_FAILED:        { max: 10, windowMs: 10 * 60 * 1000 },
  ADMIN_DELIVERY_MANUAL:  { max: 10, windowMs: 10 * 60 * 1000 },
  WITHDRAWAL_REQUEST:     { max: 10, windowMs: 10 * 60 * 1000 },
  WITHDRAWAL_MUTATION:    { max: 30, windowMs: 10 * 60 * 1000 },
  REFUND_REQUEST:         { max: 10, windowMs: 10 * 60 * 1000 },
  REFUND_MUTATION:        { max: 30, windowMs: 10 * 60 * 1000 },
  PAYOUT_DESTINATION_MANAGE: { max: 20, windowMs: 10 * 60 * 1000 },
  COMMISSION_PLAN_MUTATION: { max: 20, windowMs: 10 * 60 * 1000 },
  COMMISSION_REVERSAL: { max: 10, windowMs: 10 * 60 * 1000 },
  CATALOG_MUTATION: { max: 60, windowMs: 10 * 60 * 1000 },
  CATALOG_IMPORT: { max: 10, windowMs: 60 * 60 * 1000 },
  CATALOG_MEDIA_UPLOAD: { max: 30, windowMs: 60 * 60 * 1000 },
  STOREFRONT_SEARCH: { max: 120, windowMs: 10 * 60 * 1000 },
  STOREFRONT_SUGGESTIONS: { max: 90, windowMs: 10 * 60 * 1000 },
  STOREFRONT_LOCATION: { max: 30, windowMs: 10 * 60 * 1000 },
  STOREFRONT_ADMIN_MUTATION: { max: 60, windowMs: 10 * 60 * 1000 },
  MARKETPLACE_CART_MUTATION: { max: 45, windowMs: 10 * 60 * 1000 },
  MARKETPLACE_CHECKOUT_MUTATION: { max: 25, windowMs: 10 * 60 * 1000 },
  MARKETPLACE_RESERVATION: { max: 8, windowMs: 10 * 60 * 1000 },
  STORE_ORDER_MUTATION: { max: 30, windowMs: 10 * 60 * 1000 },
  STORE_ORDER_HANDOFF: { max: 8, windowMs: 10 * 60 * 1000 },
  STORE_ORDER_CUSTOMER_MUTATION: { max: 15, windowMs: 10 * 60 * 1000 },
  STORE_ORDER_ADMIN_RECOVERY: { max: 12, windowMs: 10 * 60 * 1000 },
};

// ─── IP extraction ─────────────────────────────────────────────────────────────

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

// ─── Core check ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
  failClosed?: boolean;
  errorResponse?: {
    code: "SERVICE_TEMPORARILY_UNAVAILABLE";
    message: "This operation is temporarily unavailable.";
  };
}

export function resolveRateLimitPolicy(
  normalPolicy: RateLimitPolicy,
): RateLimitPolicy {
  const isIsolatedE2E =
    process.env.KT_RUNTIME_ENV === "e2e" &&
    process.env.KT_E2E_RATE_LIMIT_MODE === "relaxed";

  if (!isIsolatedE2E) {
    return normalPolicy;
  }

  const E2E_FINITE_LIMIT = 10000;

  return {
    ...normalPolicy,
    max: Math.max(normalPolicy.max, E2E_FINITE_LIMIT),
  };
}

export function clearRateLimitStoreForTesting(): void {
  store.clear();
}

export function checkRateLimit(
  key: string,
  config: RateLimitPolicy
): RateLimitResult {
  const isProd = process.env.NODE_ENV === "production";
  const hasRedis = !!process.env.REDIS_URL;

  // Fail closed in production for distributed-required endpoints when Redis is missing
  if (isProd && config.distributedRequired && !hasRedis) {
    return {
      ok: false,
      retryAfterSeconds: 60,
      failClosed: true,
      errorResponse: {
        code: "SERVICE_TEMPORARILY_UNAVAILABLE",
        message: "This operation is temporarily unavailable.",
      },
    };
  }

  const resolvedConfig = resolveRateLimitPolicy(config);
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  prune(entry, resolvedConfig.windowMs);

  if (entry.timestamps.length >= resolvedConfig.max) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest !== undefined ? Math.max(oldest + resolvedConfig.windowMs - now, 0) : resolvedConfig.windowMs;
    return {
      ok: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.timestamps.push(now);
  return { ok: true };
}

// ─── Convenience wrappers ──────────────────────────────────────────────────────

export function checkIpRateLimit(
  req: NextRequest,
  endpoint: string,
  config: RateLimitPolicy
): RateLimitResult {
  const ip = getClientIp(req);
  return checkRateLimit(`${endpoint}:${ip}`, config);
}

export function checkAuthRateLimit(
  req: NextRequest,
  endpoint: string,
  email: string,
  config: RateLimitPolicy
): RateLimitResult {
  const ip = getClientIp(req);
  const normalizedEmail = email.toLowerCase().trim();
  const combined = checkRateLimit(`${endpoint}:${ip}:${normalizedEmail}`, config);
  if (!combined.ok) return combined;
  return checkRateLimit(`${endpoint}:${ip}`, config);
}
