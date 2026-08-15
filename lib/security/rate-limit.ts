import { type NextRequest } from "next/server";
import {
  defaultRateLimitService,
  clearRateLimitMemoryStore,
  resolveRateLimitPolicy,
  type RateLimitBackendStatus,
  type RateLimitPolicyWithDistributed,
} from "./distributed-rate-limit";
import { isRedisConfigured } from "./redis-client";

export type RateLimitPolicy = RateLimitPolicyWithDistributed;

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
  DRIVER_LOCATION:        { max: 60, windowMs: 10 * 60 * 1000, distributedRequired: true },
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
  PRIVATE_MEDIA_UPLOAD: { max: 20, windowMs: 60 * 60 * 1000, distributedRequired: true },
  PRIVACY_REQUEST_SUBMISSION: { max: 5, windowMs: 60 * 60 * 1000, distributedRequired: true },
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
  COD_COLLECTION: { max: 12, windowMs: 10 * 60 * 1000, distributedRequired: true },
  COD_RECONCILIATION: { max: 12, windowMs: 10 * 60 * 1000, distributedRequired: true },
  CLAIM_CREATE: { max: 8, windowMs: 60 * 60 * 1000, distributedRequired: true },
  CLAIM_MUTATION: { max: 30, windowMs: 10 * 60 * 1000, distributedRequired: true },
  MANAGED_MARKETING_REQUEST_CREATE: { max: 10, windowMs: 60 * 60 * 1000, distributedRequired: true },
  MANAGED_MARKETING_REQUEST_MUTATION: { max: 40, windowMs: 10 * 60 * 1000, distributedRequired: true },
  MANAGED_MARKETING_CREATIVE_ATTACH: { max: 20, windowMs: 60 * 60 * 1000, distributedRequired: true },
  MANAGED_MARKETING_PAYMENT_PREPARE: { max: 8, windowMs: 60 * 60 * 1000, distributedRequired: true },
  COOKIE_PREFERENCE_MUTATION: { max: 30, windowMs: 10 * 60 * 1000, distributedRequired: true },
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
  backendUsed?: RateLimitBackendStatus;
  warning?: string;
  errorResponse?: {
    code: "SERVICE_TEMPORARILY_UNAVAILABLE";
    message: "This operation is temporarily unavailable.";
  };
}

export { resolveRateLimitPolicy };

export function clearRateLimitStoreForTesting(): void {
  clearRateLimitMemoryStore();
}

/**
 * Single authoritative rate limit evaluation function.
 * Uses Redis in production or when configured; falls back cleanly in development/test.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitPolicy,
  options?: { customNow?: number; customMember?: string }
): Promise<RateLimitResult> {
  const isProd = process.env.NODE_ENV === "production";
  const hasRedis = isRedisConfigured();

  // Fail closed in production for distributed-required endpoints when Redis is absent
  if (isProd && config.distributedRequired && !hasRedis) {
    return {
      ok: false,
      retryAfterSeconds: 60,
      failClosed: true,
      backendUsed: "FAIL_CLOSED",
      errorResponse: {
        code: "SERVICE_TEMPORARILY_UNAVAILABLE",
        message: "This operation is temporarily unavailable.",
      },
    };
  }

  const decision = await defaultRateLimitService.consume(key, config, options);

  return {
    ok: decision.accepted,
    retryAfterSeconds: decision.retryAfterSeconds,
    failClosed:
      decision.backendUsed === "FAIL_CLOSED" ||
      decision.backendUsed === "DISTRIBUTED_UNAVAILABLE",
    backendUsed: decision.backendUsed,
    warning: decision.warning,
    errorResponse: decision.errorResponse,
  };
}

// ─── Convenience wrappers ──────────────────────────────────────────────────────

export async function checkIpRateLimit(
  req: NextRequest,
  endpoint: string,
  config: RateLimitPolicy
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  return checkRateLimit(`${endpoint}:${ip}`, config);
}

export async function checkAuthRateLimit(
  req: NextRequest,
  endpoint: string,
  email: string,
  config: RateLimitPolicy
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const normalizedEmail = email.toLowerCase().trim();
  const combined = await checkRateLimit(`${endpoint}:${ip}:${normalizedEmail}`, config);
  if (!combined.ok) return combined;
  return checkRateLimit(`${endpoint}:${ip}`, config);
}
