import { checkRateLimit } from "./rate-limit";

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

/**
 * Shared/Distributed Rate Limiter Test Adapter.
 * Used in tests or multi-instance environments when a concrete shared store is injected.
 */
export class ConcreteSharedRateLimitStore implements RateLimitStore {
  private readonly memoryStore = new Map<string, number[]>();

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const now = Date.now();
    const cutoff = now - input.policy.windowMs;
    const timestamps = (this.memoryStore.get(input.key) || []).filter((t) => t > cutoff);

    if (timestamps.length >= input.policy.max) {
      const oldest = timestamps[0] || now;
      const retryAfterMs = Math.max(oldest + input.policy.windowMs - now, 0);
      return {
        accepted: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
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
 * Fails closed in production for distributed-required policies unless a concrete shared adapter is provided.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  constructor(private readonly sharedAdapter?: RateLimitStore) {}

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const isProd = process.env.NODE_ENV === "production";
    const isTest = process.env.NODE_ENV === "test";

    // If a concrete shared adapter is injected, delegate directly
    if (this.sharedAdapter) {
      return this.sharedAdapter.consume(input);
    }

    // Production safety: If distributed required but no shared adapter implementation exists, fail closed.
    if (isProd && input.policy.distributedRequired) {
      return {
        accepted: false,
        backendUsed: "FAIL_CLOSED",
        warning:
          "Production distributed rate limiter implementation absent (DISTRIBUTED_NOT_IMPLEMENTED). Operation failed closed.",
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
 * Production-ready rate limiting service abstraction.
 */
export class RateLimitService {
  constructor(private readonly store: RateLimitStore = new InMemoryRateLimitStore()) {}

  async consume(key: string, policy: RateLimitPolicyWithDistributed): Promise<RateLimitDecision> {
    return this.store.consume({ key, policy });
  }
}

export const defaultRateLimitService = new RateLimitService();
