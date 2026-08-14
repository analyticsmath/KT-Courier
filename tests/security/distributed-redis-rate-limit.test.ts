import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  RateLimitService,
  RedisRateLimitStore,
  InMemoryRateLimitStore,
  ConcreteSharedRateLimitStore,
} from "@/lib/security/distributed-rate-limit";
import { checkRedisHealth, redactRedisUrl } from "@/lib/security/redis-client";

describe("Distributed Rate Limiting Authority & Safety", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("proves two independent limiter instances share state via a shared store", async () => {
    const sharedStore = new ConcreteSharedRateLimitStore();
    const instanceA = new RateLimitService(sharedStore);
    const instanceB = new RateLimitService(sharedStore);

    const policy = { max: 3, windowMs: 10_000, distributedRequired: true };
    const key = "shared-user-action-123";

    // Request 1 on Instance A
    const res1 = await instanceA.consume(key, policy);
    expect(res1.accepted).toBe(true);
    expect(res1.backendUsed).toBe("DISTRIBUTED_READY");

    // Request 2 on Instance B
    const res2 = await instanceB.consume(key, policy);
    expect(res2.accepted).toBe(true);

    // Request 3 on Instance A
    const res3 = await instanceA.consume(key, policy);
    expect(res3.accepted).toBe(true);

    // Request 4 on Instance B (should be rejected across nodes)
    const res4 = await instanceB.consume(key, policy);
    expect(res4.accepted).toBe(false);
    expect(res4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("proves different subjects are completely isolated under the shared limiter", async () => {
    const sharedStore = new ConcreteSharedRateLimitStore();
    const instance = new RateLimitService(sharedStore);
    const policy = { max: 2, windowMs: 10_000, distributedRequired: true };

    const subjectA = "subject-A";
    const subjectB = "subject-B";

    // Consume subject A to limit
    await instance.consume(subjectA, policy);
    await instance.consume(subjectA, policy);
    const blockedA = await instance.consume(subjectA, policy);
    expect(blockedA.accepted).toBe(false);

    // Subject B must still be accepted
    const allowedB = await instance.consume(subjectB, policy);
    expect(allowedB.accepted).toBe(true);
  });

  it("proves production fails closed when distributed rate limiting is required but Redis is missing", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.REDIS_URL;

    const store = new InMemoryRateLimitStore();
    const service = new RateLimitService(store);

    const policy = { max: 10, windowMs: 60_000, distributedRequired: true };
    const decision = await service.consume("high-risk-auth-op", policy);

    expect(decision.accepted).toBe(false);
    expect(decision.backendUsed).toBe("FAIL_CLOSED");
    expect(decision.errorResponse).toBeDefined();
    expect(decision.errorResponse?.code).toBe("SERVICE_TEMPORARILY_UNAVAILABLE");
  });

  it("proves production fails closed when Redis connection throws an error", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.REDIS_URL = "redis://invalid-host:6379";

    const redisStore = new RedisRateLimitStore();
    const policy = { max: 5, windowMs: 60_000, distributedRequired: true };

    const decision = await redisStore.consume({ key: "checkout-op", policy });

    expect(decision.accepted).toBe(false);
    expect(["FAIL_CLOSED", "DISTRIBUTED_UNAVAILABLE"]).toContain(decision.backendUsed);
    expect(decision.errorResponse?.code).toBe("SERVICE_TEMPORARILY_UNAVAILABLE");
  });

  it("proves non-production or non-distributed policies fall back to in-memory safely", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.REDIS_URL;

    const store = new InMemoryRateLimitStore();
    const service = new RateLimitService(store);

    const policy = { max: 5, windowMs: 60_000, distributedRequired: false };
    const decision = await service.consume("dev-action", policy);

    expect(decision.accepted).toBe(true);
    expect(decision.backendUsed).toBe("MEMORY_DEVELOPMENT");
  });

  it("proves Redis URL redaction never leaks passwords or credentials", () => {
    const rawUrl = "redis://:secret_password_123@redis-cluster.internal:6379/0";
    const redacted = redactRedisUrl(rawUrl);

    expect(redacted).not.toContain("secret_password_123");
    expect(redacted).toContain("REDACTED");
    expect(redactRedisUrl(undefined)).toBe("NOT_CONFIGURED");
    expect(redactRedisUrl("not-a-valid-url")).toBe("[MALFORMED_REDIS_URL]");
  });

  it("proves Redis healthcheck safely reports NOT_CONFIGURED when environment variable is absent", async () => {
    delete process.env.REDIS_URL;
    const health = await checkRedisHealth();

    expect(health.configured).toBe(false);
    expect(health.connected).toBe(false);
    expect(health.status).toBe("NOT_CONFIGURED");
  });
});
