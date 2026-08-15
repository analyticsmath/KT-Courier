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
import { redactRedisUrl } from "../../lib/security/redis-client";

const REDIS_CONTAINER_NAME = `kt-redis-it-${Date.now()}`;
const REDIS_PORT = process.env.KT_STRICT_REDIS_PORT ? Number(process.env.KT_STRICT_REDIS_PORT) : 6389;
const REDIS_URL = process.env.REDIS_URL || `redis://localhost:${REDIS_PORT}`;
const isStrict = process.env.STRICT_REDIS_INTEGRATION === "1";

describe("P1R-001 & P1R-002: Real Redis Distributed Rate Limiting & Same-Millisecond Collision Proof", () => {
  let clientA: Redis;
  let clientB: Redis;
  let redisAvailable = false;
  let containerStarted = false;

  beforeAll(async () => {
    try {
      if (!process.env.REDIS_URL) {
        // Start a disposable, isolated Redis test container if not already provided by runner
        try {
          execSync(`docker run --rm -d --name ${REDIS_CONTAINER_NAME} -p ${REDIS_PORT}:6379 redis:7-alpine`, {
            stdio: "ignore",
          });
          containerStarted = true;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch {}
      }

      clientA = new Redis(REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
      });
      clientA.on("error", () => {});

      clientB = new Redis(REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
      });
      clientB.on("error", () => {});

      await clientA.connect();
      await clientB.connect();
      
      const pingA = await clientA.ping();
      const pingB = await clientB.ping();
      if (pingA === "PONG" && pingB === "PONG") {
        redisAvailable = true;
      }
    } catch (err) {
      if (isStrict) {
        throw new Error(`[STRICT_REDIS_FAILURE] Redis integration instance required but unreachable: ${err}`);
      }
      console.warn("[SKIP_REDIS_INTEGRATION] Docker or Redis unavailable:", err);
    }
  }, 20000);

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
    if (containerStarted) {
      try {
        execSync(`docker stop ${REDIS_CONTAINER_NAME}`, { stdio: "ignore" });
      } catch {}
    }
  }, 10000);

  it("1: Client A consumption affects Client B under same partition key", async () => {
    if (!redisAvailable) {
      if (isStrict) throw new Error("Redis required in strict mode.");
      return;
    }

    const testKey = `test-shared-client-key-${randomUUID()}`;
    const policy: RateLimitPolicyWithDistributed = {
      max: 3,
      windowMs: 60_000,
      distributedRequired: true,
    };

    const redisKey = `ratelimit:${testKey}`;
    const windowMs = policy.windowMs;
    const max = policy.max;
    const ttlSeconds = 120;

    // Instance A consumes requests 1 and 2
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
    expect(res1[0]).toBe(1);

    const res2 = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(res2[0]).toBe(1);

    // Instance B consumes request 3 (last allowed)
    const res3 = (await clientB.eval(
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

    // Instance B tries request 4 -> rejected because Instance A consumed quota
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
    expect(res4[0]).toBe(0);
    expect(res4[2]).toBeGreaterThan(0);
  });

  it("2: Cross-endpoint shared global rate limiting enforces global ceiling", async () => {
    if (!redisAvailable) {
      if (isStrict) throw new Error("Redis required in strict mode.");
      return;
    }

    const testKey = `test-global-cross-endpoint-${randomUUID()}`;
    const policy: RateLimitPolicyWithDistributed = {
      max: 4,
      windowMs: 60_000,
      distributedRequired: true,
    };

    const redisKey = `ratelimit:${testKey}`;
    const windowMs = policy.windowMs;
    const max = policy.max;
    const ttlSeconds = 120;

    // Alternating calls between Instance A and Instance B
    for (let i = 0; i < 4; i++) {
      const client = i % 2 === 0 ? clientA : clientB;
      const res = (await client.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        String(Date.now()),
        String(windowMs),
        String(max),
        String(ttlSeconds),
        `${Date.now()}:${randomUUID()}`
      )) as [number, number, number];
      expect(res[0]).toBe(1);
    }

    // 5th request on Instance A fails
    const resA = (await clientA.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(resA[0]).toBe(0);

    // 6th request on Instance B also fails
    const resB = (await clientB.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      String(Date.now()),
      String(windowMs),
      String(max),
      String(ttlSeconds),
      `${Date.now()}:${randomUUID()}`
    )) as [number, number, number];
    expect(resB[0]).toBe(0);
  });

  it("3: Different rate limit keys remain strictly isolated across instances", async () => {
    if (!redisAvailable) {
      if (isStrict) throw new Error("Redis required in strict mode.");
      return;
    }

    const key1 = `user-alpha-${randomUUID()}`;
    const key2 = `user-beta-${randomUUID()}`;
    const policy: RateLimitPolicyWithDistributed = {
      max: 1,
      windowMs: 60_000,
      distributedRequired: true,
    };

    const redisKey1 = `ratelimit:${key1}`;
    const redisKey2 = `ratelimit:${key2}`;

    // Fill key1 via Client A
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

    // Key1 is now full; subsequent request via Client A is rejected
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

    // Key2 is independent and must succeed via Client B
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

  it("4: Rolling-window expiration frees capacity after window elapsed", async () => {
    if (!redisAvailable) {
      if (isStrict) throw new Error("Redis required in strict mode.");
      return;
    }

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

  it("5: Missing/unreachable Redis in production fails closed for distributedRequired policies", async () => {
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

  it("6: Credentials and sensitive secrets in Redis URLs are never exposed in decisions or logs", () => {
    const rawSecretUrl = "redis://secure_admin:super_secret_redis_password_987@127.0.0.1:6379";
    const redacted = redactRedisUrl(rawSecretUrl);

    expect(redacted).not.toContain("super_secret_redis_password_987");
    expect(redacted).toContain("REDACTED");
    expect(redacted).toContain("127.0.0.1:6379");

    const unconfigured = redactRedisUrl(undefined);
    expect(unconfigured).toBe("NOT_CONFIGURED");

    const malformed = redactRedisUrl("not a valid url :// invalid");
    expect(malformed).toBe("[MALFORMED_REDIS_URL]");
  });

  it("7: Same-millisecond contention with concurrent Promise.all operations across two clients proves independent counting and exact ZCARD cardinality", async () => {
    if (!redisAvailable) {
      if (isStrict) throw new Error("Redis required in strict mode.");
      return;
    }

    const testKey = `test-same-ms-collision-${randomUUID()}`;
    const policy: RateLimitPolicyWithDistributed = {
      max: 8,
      windowMs: 60_000,
      distributedRequired: true,
    };

    const redisKey = `ratelimit:${testKey}`;
    const windowMs = policy.windowMs;
    const max = policy.max;
    const ttlSeconds = 120;

    // Use a fixed timestamp for ALL requests to simulate concurrent same-millisecond intake
    const fixedTimestamp = 1750000000000;
    const totalRequests = 24;

    // Launch all 24 requests concurrently with Promise.all, alternating between clientA and clientB
    const promises: Array<Promise<[number, number, number]>> = [];

    for (let i = 0; i < totalRequests; i++) {
      const memberId = `${fixedTimestamp}:${randomUUID()}`;
      const client = i % 2 === 0 ? clientA : clientB;

      promises.push(
        client.eval(
          SLIDING_WINDOW_LUA,
          1,
          redisKey,
          String(fixedTimestamp),
          String(windowMs),
          String(max),
          String(ttlSeconds),
          memberId
        ) as Promise<[number, number, number]>
      );
    }

    const results = await Promise.all(promises);

    const acceptedCount = results.filter((r) => r[0] === 1).length;
    const rejectedCount = results.filter((r) => r[0] === 0).length;

    // Exactly `max` (8) must succeed, and the remaining 16 must be rejected.
    // If requests had collapsed due to same timestamp, all 24 would have overwritten one member
    // and all 24 would have returned accepted (count would remain 1).
    expect(acceptedCount).toBe(8);
    expect(rejectedCount).toBe(16);

    // Verify raw ZCARD in Redis is exactly 8
    const card = await clientA.zcard(redisKey);
    expect(card).toBe(8);

    // Verify all 8 members in ZSET have score equal to fixedTimestamp and are distinct
    const membersWithScores = await clientA.zrange(redisKey, 0, -1, "WITHSCORES");
    expect(membersWithScores.length).toBe(16); // 8 pairs of [member, score]
    for (let j = 0; j < membersWithScores.length; j += 2) {
      const member = membersWithScores[j];
      const score = Number(membersWithScores[j + 1]);
      expect(score).toBe(fixedTimestamp);
      expect(member.startsWith(`${fixedTimestamp}:`)).toBe(true);
    }
  });
});
