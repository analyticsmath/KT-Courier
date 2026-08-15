import { randomUUID } from "node:crypto";
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
  customNow?: number;
  customMember?: string;
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

export function resolveRateLimitPolicy(
  normalPolicy: RateLimitPolicyWithDistributed
): RateLimitPolicyWithDistributed {
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

// ─── Process-memory sliding-window fallback (dev/test only) ───────────────────

const memoryStore = new Map<string, number[]>();

export function clearRateLimitMemoryStore(): void {
  memoryStore.clear();
}

export function consumeInMemory(
  key: string,
  policy: RateLimitPolicyWithDistributed,
  now = Date.now()
): RateLimitDecision {
  const resolvedConfig = resolveRateLimitPolicy(policy);
  let timestamps = memoryStore.get(key) || [];
  const cutoff = now - resolvedConfig.windowMs;
  timestamps = timestamps.filter((t) => t > cutoff);

  if (timestamps.length >= resolvedConfig.max) {
    const oldest = timestamps[0] ?? now;
    const retryAfterMs = Math.max(oldest + resolvedConfig.windowMs - now, 0);
    return {
      accepted: false,
      retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
      backendUsed: process.env.NODE_ENV === "test" ? "MEMORY_TEST" : "MEMORY_DEVELOPMENT",
    };
  }

  timestamps.push(now);
  memoryStore.set(key, timestamps);

  return {
    accepted: true,
    backendUsed: process.env.NODE_ENV === "test" ? "MEMORY_TEST" : "MEMORY_DEVELOPMENT",
  };
}

// ─── Atomic Lua sliding-window rate limit script ─────────────────────────────
// Member identity uses <timestamp>:<uuid-nonce> passed as ARGV[5] so that requests
// occurring within the same millisecond are stored as distinct sorted-set entries.

export const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local memberId = ARGV[5]

local clearBefore = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)
local currentCount = redis.call('ZCARD', key)

if currentCount < max then
  redis.call('ZADD', key, now, memberId)
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
  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const isProd = process.env.NODE_ENV === "production";
    const resolvedPolicy = resolveRateLimitPolicy(input.policy);
    const client = getRedisClient();

    if (!client || !isRedisConfigured()) {
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
      // Fall back to memory in dev/test
      return consumeInMemory(input.key, input.policy, input.customNow);
    }

    const redisKey = `ratelimit:${input.key}`;
    const now = input.customNow ?? Date.now();
    const windowMs = resolvedPolicy.windowMs;
    const max = resolvedPolicy.max;
    const ttlSeconds = Math.max(Math.ceil(windowMs / 1000) * 2, 60);
    const memberId = input.customMember ?? `${now}:${randomUUID()}`;

    try {
      if (client.status === "wait" || client.status === "close") {
        await client.connect();
      }

      const result = (await client.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        String(now),
        String(windowMs),
        String(max),
        String(ttlSeconds),
        memberId
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
      const memRes = consumeInMemory(input.key, input.policy, input.customNow);
      return {
        ...memRes,
        warning: `Redis failed, fell back to memory: ${errMsg}`,
      };
    }
  }
}

/**
 * Shared/Distributed Rate Limiter Test Adapter.
 * Used in tests when a concrete shared in-memory store is injected across instances.
 */
export class ConcreteSharedRateLimitStore implements RateLimitStore {
  private readonly sharedEntries = new Map<string, Array<{ score: number; member: string }>>();

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const resolvedPolicy = resolveRateLimitPolicy(input.policy);
    const now = input.customNow ?? Date.now();
    const cutoff = now - resolvedPolicy.windowMs;
    const existing = (this.sharedEntries.get(input.key) || []).filter((e) => e.score > cutoff);

    if (existing.length >= resolvedPolicy.max) {
      const oldest = existing[0]?.score ?? now;
      const retryAfterMs = Math.max(oldest + resolvedPolicy.windowMs - now, 0);
      return {
        accepted: false,
        retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
        backendUsed: "DISTRIBUTED_READY",
      };
    }

    const memberId = input.customMember ?? `${now}:${randomUUID()}`;
    existing.push({ score: now, member: memberId });
    this.sharedEntries.set(input.key, existing);

    return {
      accepted: true,
      backendUsed: "DISTRIBUTED_READY",
    };
  }
}

/**
 * Production-aware Rate Limiter Store implementation.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly redisStore = new RedisRateLimitStore();

  constructor(private readonly sharedAdapter?: RateLimitStore) {}

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const isProd = process.env.NODE_ENV === "production";
    const isTest = process.env.NODE_ENV === "test";

    if (this.sharedAdapter) {
      return this.sharedAdapter.consume(input);
    }

    if (isRedisConfigured()) {
      return this.redisStore.consume(input);
    }

    if (isProd && input.policy.distributedRequired) {
      return {
        accepted: false,
        backendUsed: "FAIL_CLOSED",
        warning:
          "Production distributed rate limiter unconfigured for distributed-required policy. Operation failed closed.",
        errorResponse: {
          code: "SERVICE_TEMPORARILY_UNAVAILABLE",
          message: "This operation is temporarily unavailable.",
        },
      };
    }

    const memRes = consumeInMemory(input.key, input.policy, input.customNow);
    return {
      ...memRes,
      backendUsed: isTest ? "MEMORY_TEST" : "MEMORY_DEVELOPMENT",
      ...(isProd && {
        warning:
          "Production environment operating process-memory rate limiter for non-distributed route.",
      }),
    };
  }
}

/**
 * Authoritative Rate Limiting Service.
 */
export class RateLimitService {
  constructor(private store: RateLimitStore = new InMemoryRateLimitStore()) {}

  setStore(store: RateLimitStore): void {
    this.store = store;
  }

  async consume(
    key: string,
    policy: RateLimitPolicyWithDistributed,
    options?: { customNow?: number; customMember?: string }
  ): Promise<RateLimitDecision> {
    return this.store.consume({
      key,
      policy,
      customNow: options?.customNow,
      customMember: options?.customMember,
    });
  }
}

export const defaultRateLimitService = new RateLimitService();
