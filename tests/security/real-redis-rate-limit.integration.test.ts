/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  SLIDING_WINDOW_LUA,
  RedisRateLimitStore,
  type RateLimitPolicyWithDistributed,
} from "../../lib/security/distributed-rate-limit";

const REDIS_CONTAINER_NAME = `kt-redis-it-${Date.now()}`;
const REDIS_PORT = 6389;
const REDIS_URL = `redis://localhost:${REDIS_PORT}`;

describe("P1R-001 & P1R-002: Real Redis Distributed Rate Limiting & Same-Millisecond Collision Proof", () => {
  let clientA: Redis;
  let clientB: Redis;
  let redisAvailable = false;

  beforeAll(async () => {
    try {
      // Start a disposable, isolated Redis test container
      execSync(`docker run --rm -d --name ${REDIS_CONTAINER_NAME} -p ${REDIS_PORT}:6379 redis:7-alpine`, {
        stdio: "ignore",
      });
      
      // Wait for Redis to accept connections
      await new Promise((resolve) => setTimeout(resolve, 1500));

      clientA = new Redis(REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
      });

      clientB = new Redis(REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
      });

      await clientA.connect();
      await clientB.connect();
      redisAvailable = true;
    } catch (err) {
      console.warn("[SKIP_REDIS_INTEGRATION] Docker or Redis unavailable:", err);
    }
  }, 15000);

  afterAll(async () => {
    if (clientA) {
      try {
        await clientA.quit();
      } catch {
        clientA.disconnect();
      }
    }
    if (clientB) {
      try {
        await clientB.quit();
      } catch {
        clientB.disconnect();
      }
    }
    try {
      execSync(`docker stop ${REDIS_CONTAINER_NAME}`, { stdio: "ignore" });
    } catch {}
  }, 10000);

  it("1 & 2 & 3 & 4 & 5: Global limit observed across two independent ioredis clients consuming alternately", async () => {
    if (!redisAvailable) return;

    const testKey = `test-global-cross-instance-${randomUUID()}`;
    const policy: RateLimitPolicyWithDistributed = {
      max: 6,
      windowMs: 60_000,
      distributedRequired: true,
    };

    const redisKey = `ratelimit:${testKey}`;
    const windowMs = policy.windowMs;
    const max = policy.max;
    const ttlSeconds = 120;

    // Instance A consumes request 1
    const res1 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res1[0]).toBe(1); // allowed

    // Instance B consumes request 2
    const res2 = (await clientB.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res2[0]).toBe(1); // allowed

    // Instance A consumes request 3
    const res3 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res3[0]).toBe(1);

    // Instance B consumes request 4
    const res4 = (await clientB.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res4[0]).toBe(1);

    // Instance A consumes request 5
    const res5 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res5[0]).toBe(1);

    // Instance B consumes request 6 (last allowed)
    const res6 = (await clientB.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res6[0]).toBe(1);

    // Instance A tries request 7 -> MUST BE REJECTED GLOBALLY
    const res7 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res7[0]).toBe(0); // rejected
    expect(res7[2]).toBeGreaterThan(0); // retryAfterSeconds

    // Instance B tries request 8 -> MUST ALSO BE REJECTED GLOBALLY
    const res8 = (await clientB.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res8[0]).toBe(0); // rejected
  });

  it("6: Same-millisecond contention test proves all requests at identical timestamp are counted independently", async () => {
    if (!redisAvailable) return;

    const testKey = `test-same-ms-collision-${randomUUID()}`;
    const policy: RateLimitPolicyWithDistributed = {
      max: 5,
      windowMs: 60_000,
      distributedRequired: true,
    };

    const redisKey = `ratelimit:${testKey}`;
    const windowMs = policy.windowMs;
    const max = policy.max;
    const ttlSeconds = 120;

    // Use a fixed timestamp for ALL requests to simulate concurrent same-millisecond intake
    const fixedTimestamp = 1750000000000;
    const totalRequests = 10;

    const results: Array<[number, number, number]> = [];

    for (let i = 0; i < totalRequests; i++) {
      // Unique member id generated server-side for each request
      const memberId = `${fixedTimestamp}:${randomUUID()}`;
      const client = i % 2 === 0 ? clientA : clientB;

      const res = (await client.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        String(fixedTimestamp),
        String(windowMs),
        String(max),
        String(ttlSeconds),
        memberId
      )) as [number, number, number];

      results.push(res);
    }

    const acceptedCount = results.filter((r) => r[0] === 1).length;
    const rejectedCount = results.filter((r) => r[0] === 0).length;

    // Exactly `max` (5) must succeed, and the remaining 5 must be rejected.
    // If requests had collapsed due to same timestamp, all 10 would have overwritten one member
    // and all 10 would have returned accepted (count would remain 1).
    expect(acceptedCount).toBe(5);
    expect(rejectedCount).toBe(5);

    // Verify raw ZCARD in Redis is exactly 5
    const card = await clientA.zcard(redisKey);
    expect(card).toBe(5);
  });

  it("7: TTL/sliding window expiration frees capacity after window elapsed", async () => {
    if (!redisAvailable) return;

    const testKey = `test-window-expiry-${randomUUID()}`;
    const policy: RateLimitPolicyWithDistributed = {
      max: 2,
      windowMs: 5_000,
      distributedRequired: true,
    };

    const redisKey = `ratelimit:${testKey}`;
    const windowMs = policy.windowMs;
    const max = policy.max;
    const ttlSeconds = 60;

    const t0 = 100000;

    // Two requests at t0
    const r1 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(t0),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${t0}:${randomUUID()}`
    )) as [number, number, number];
    expect(r1[0]).toBe(1);

    const r2 = (await clientB.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(t0 + 100),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${t0 + 100}:${randomUUID()}`
    )) as [number, number, number];
    expect(r2[0]).toBe(1);

    // Third request within window fails
    const r3 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(t0 + 2000),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${t0 + 2000}:${randomUUID()}`
    )) as [number, number, number];
    expect(r3[0]).toBe(0);

    // Advance time past window (t0 + 6000)
    const tAfter = t0 + 6000;
    const r4 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(tAfter),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${tAfter}:${randomUUID()}`
    )) as [number, number, number];
    expect(r4[0]).toBe(1); // Capacity restored!
  });

  it("8: Different rate limit keys remain strictly isolated", async () => {
    if (!redisAvailable) return;

    const key1 = `user-alpha-${randomUUID()}`;
    const key2 = `user-beta-${randomUUID()}`;
    const policy: RateLimitPolicyWithDistributed = {
      max: 1,
      windowMs: 60_000,
      distributedRequired: true,
    };

    const redisKey1 = `ratelimit:${key1}`;
    const redisKey2 = `ratelimit:${key2}`;

    // Fill key1
    const r1 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey1,
      String(Date.now()),
      String(60000),
      String(1),
      String(60),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(r1[0]).toBe(1);

    // Key1 is full
    const r2 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey1,
      String(Date.now()),
      String(60000),
      String(1),
      String(60),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(r2[0]).toBe(0);

    // Key2 is independent and must succeed
    const r3 = (await clientB.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey2,
      String(Date.now()),
      String(60000),
      String(1),
      String(60),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(r3[0]).toBe(1);
  });

  it("9 & 10: Missing/unreachable Redis in production fails closed for distributedRequired policies", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalRedis = process.env.REDIS_URL;

    try {
      (process.env as any).NODE_ENV = "production";
      process.env.REDIS_URL = "redis://invalid-nonexistent-host-9999:6379";

      const store = new RedisRateLimitStore();
      const decision = await store.consume({
        key: "prod-isolated-test",
        policy: {
          max: 5,
          windowMs: 60_000,
          distributedRequired: true,
        },
      });

      expect(decision.accepted).toBe(false);
      expect(decision.backendUsed).toBe("DISTRIBUTED_UNAVAILABLE");
      expect(decision.errorResponse?.code).toBe("SERVICE_TEMPORARILY_UNAVAILABLE");
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.REDIS_URL = originalRedis;
    }
  });
});
