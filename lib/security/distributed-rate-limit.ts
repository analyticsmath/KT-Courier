import { checkRateLimit, resolveRateLimitPolicy } from "./rate-limit";
import { getRedisClient, isRedisConfigured } from "./redis-client";

export type RateLimitBackendStatus =
  | "MEMORY_DEVELOPMENT"
  | "MEMORY_TEST"
  | "DISTRIBUTED_READY"
  | "DISTRIBUTED_NOT_IMPLEMENTED"
  | "DISTRIBUTED_UNAVAILABLE"
  | "FAIL_CLOSED";

export interface RateLimitPolicyWithDistributed {
  max: number;
  windowMs: number;
  distributedRequired?: boolean;
}

export interface RateLimitConsumeInput {
  key: string;
  policy: RateLimitPolicyWithDistributed;
}

export interface RateLimitDecision {
  accepted: boolean;
  retryAfterSeconds?: number;
  backendUsed: RateLimitBackendStatus;
  warning?: string;
  errorResponse?: {
    code: "SERVICE_TEMPORARILY_UNAVAILABLE";
    message: "This operation is temporarily unavailable.";
  };
}

export interface RateLimitStore {
  consume(input: RateLimitConsumeInput): Promise<RateLimitDecision>;
}

// Atomic sliding-window rate limit script in Lua
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local clearBefore = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)
local currentCount = redis.call('ZCARD', key)

if currentCount < max then
  redis.call('ZADD', key, now, now)
  redis.call('EXPIRE', key, ttl)
  return { 1, max - currentCount - 1, 0 }
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfterMs = window
  if oldest and #oldest >= 2 then
    local oldestTimestamp = tonumber(oldest[2])
    if oldestTimestamp then
      retryAfterMs = math.max(0, oldestTimestamp + window - now)
    end
  end
  return { 0, 0, math.ceil(retryAfterMs / 1000) }
end
`;

/**
 * Real Redis-backed distributed rate limiter store.
 */
export class RedisRateLimitStore implements RateLimitStore {
  private scriptSha: string | null = null;

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const isProd = process.env.NODE_ENV === "production";
    const resolvedPolicy = resolveRateLimitPolicy(input.policy);
    const client = getRedisClient();

    if (!client) {
      if (isProd && input.policy.distributedRequired) {
        return {
          accepted: false,
          backendUsed: "FAIL_CLOSED",
          warning: "Redis client unconfigured for distributed-required policy in production.",
          errorResponse: {
            code: "SERVICE_TEMPORARILY_UNAVAILABLE",
            message: "This operation is temporarily unavailable.",
          },
        };
      }
      // Fall back to memory
      const memRes = checkRateLimit(input.key, input.policy);
      return {
        accepted: memRes.ok,
        retryAfterSeconds: memRes.retryAfterSeconds,
        backendUsed: process.env.NODE_ENV === "test" ? "MEMORY_TEST" : "MEMORY_DEVELOPMENT",
      };
    }

    const redisKey = `ratelimit:${input.key}`;
    const now = Date.now();
    const windowMs = resolvedPolicy.windowMs;
    const max = resolvedPolicy.max;
    const ttlSeconds = Math.max(Math.ceil(windowMs / 1000) * 2, 60);

    try {
      if (client.status === "wait" || client.status === "close") {
        await client.connect();
      }

      // Execute atomic Lua sliding-window script
      const result = (await client.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        String(now),
        String(windowMs),
        String(max),
        String(ttlSeconds)
      )) as [number, number, number];

      const [allowed, , retryAfterSeconds] = result;

      return {
        accepted: allowed === 1,
        retryAfterSeconds: allowed === 1 ? undefined : Math.max(retryAfterSeconds, 1),
        backendUsed: "DISTRIBUTED_READY",
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      if (isProd && input.policy.distributedRequired) {
        return {
          accepted: false,
          backendUsed: "DISTRIBUTED_UNAVAILABLE",
          warning: `Distributed rate limiter error: ${errMsg}`,
          errorResponse: {
            code: "SERVICE_TEMPORARILY_UNAVAILABLE",
            message: "This operation is temporarily unavailable.",
          },
        };
      }

      // In non-production or non-distributed routes, fallback to memory
      const memRes = checkRateLimit(input.key, input.policy);
      return {
        accepted: memRes.ok,
        retryAfterSeconds: memRes.retryAfterSeconds,
        backendUsed: "DISTRIBUTED_UNAVAILABLE",
        warning: `Redis failed, fell back to memory: ${errMsg}`,
      };
    }
  }
}

/**
 * Shared/Distributed Rate Limiter Test Adapter.
 * Used in tests or multi-instance environments when a concrete shared store is injected.
 */
export class ConcreteSharedRateLimitStore implements RateLimitStore {
  private readonly memoryStore = new Map<string, number[]>();

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const resolvedPolicy = resolveRateLimitPolicy(input.policy);
    const now = Date.now();
    const cutoff = now - resolvedPolicy.windowMs;
    const timestamps = (this.memoryStore.get(input.key) || []).filter((t) => t > cutoff);

    if (timestamps.length >= resolvedPolicy.max) {
      const oldest = timestamps[0] || now;
      const retryAfterMs = Math.max(oldest + resolvedPolicy.windowMs - now, 0);
      return {
        accepted: false,
        retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
        backendUsed: "DISTRIBUTED_READY",
      };
    }

    timestamps.push(now);
    this.memoryStore.set(input.key, timestamps);

    return {
      accepted: true,
      backendUsed: "DISTRIBUTED_READY",
    };
  }
}

/**
 * Production-aware Rate Limiter Store implementation.
 * Delegates to RedisRateLimitStore when REDIS_URL is present, or shared adapter if provided.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly redisStore = new RedisRateLimitStore();

  constructor(private readonly sharedAdapter?: RateLimitStore) {}

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const isProd = process.env.NODE_ENV === "production";
    const isTest = process.env.NODE_ENV === "test";

    // If a concrete shared adapter is injected, delegate directly
    if (this.sharedAdapter) {
      return this.sharedAdapter.consume(input);
    }

    // If Redis is configured, delegate to Redis store
    if (isRedisConfigured()) {
      return this.redisStore.consume(input);
    }

    // Production safety: If distributed required but Redis is absent, fail closed.
    if (isProd && input.policy.distributedRequired) {
      return {
        accepted: false,
        backendUsed: "FAIL_CLOSED",
        warning:
          "Production distributed rate limiter implementation absent (DISTRIBUTED_NOT_CONFIGURED). Operation failed closed.",
        errorResponse: {
          code: "SERVICE_TEMPORARILY_UNAVAILABLE",
          message: "This operation is temporarily unavailable.",
        },
      };
    }

    const res = checkRateLimit(input.key, input.policy);

    return {
      accepted: res.ok,
      retryAfterSeconds: res.retryAfterSeconds,
      backendUsed: isTest ? "MEMORY_TEST" : "MEMORY_DEVELOPMENT",
      ...(isProd && {
        warning:
          "Production environment operating process-memory rate limiter for non-critical route.",
      }),
    };
  }
}

/**
 * Rate limiting service abstraction.
 */
export class RateLimitService {
  constructor(private readonly store: RateLimitStore = new InMemoryRateLimitStore()) {}

  async consume(key: string, policy: RateLimitPolicyWithDistributed): Promise<RateLimitDecision> {
    return this.store.consume({ key, policy });
  }
}

export const defaultRateLimitService = new RateLimitService();
