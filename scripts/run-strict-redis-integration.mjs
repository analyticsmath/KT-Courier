import { spawnSync } from "node:child_process";
import process from "node:process";
import Redis from "ioredis";

const PORT = process.env.KT_STRICT_REDIS_PORT || "56379";
const CONTAINER_NAME = `kt-redis-strict-acceptance-${Date.now()}`;
const REDIS_URL = `redis://127.0.0.1:${PORT}`;

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8" });
}

function stopContainer() {
  try {
    run("docker", ["stop", CONTAINER_NAME]);
  } catch {}
}

async function waitForRedis(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let client;
    try {
      client = new Redis(url, {
        lazyConnect: true,
        connectTimeout: 1000,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
      });
      client.on("error", () => {});
      await client.connect();
      const ping = await client.ping();
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
      if (ping === "PONG") return true;
    } catch {
      if (client) {
        try {
          client.disconnect();
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function main() {
  console.log(`[STRICT_REDIS_RUNNER] Starting disposable Redis container '${CONTAINER_NAME}' on port ${PORT}...`);
  
  // 1. Launch container
  const launch = run("docker", [
    "run",
    "--rm",
    "-d",
    "--name",
    CONTAINER_NAME,
    "-p",
    `${PORT}:6379`,
    "redis:7-alpine",
  ]);

  if (launch.status !== 0) {
    console.error(`[STRICT_REDIS_RUNNER] Failed to start Docker Redis container: ${launch.stderr || launch.stdout}`);
    process.exit(1);
  }

  // 2. Wait for Redis readiness
  const ready = await waitForRedis(REDIS_URL, 20000);
  if (!ready) {
    console.error("[STRICT_REDIS_RUNNER] Redis container did not respond to PONG within timeout.");
    stopContainer();
    process.exit(1);
  }

  console.log(`[STRICT_REDIS_RUNNER] Disposable Redis is healthy at ${REDIS_URL}. Running strict test suite...`);

  // 3. Run vitest
  const testEnv = {
    ...process.env,
    REDIS_URL,
    STRICT_REDIS_INTEGRATION: "1",
    KT_ALLOW_REDIS_INTEGRATION_TESTS: "1",
  };

  const testResult = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "tests/security/real-redis-rate-limit.integration.test.ts"],
    {
      env: testEnv,
      stdio: "inherit",
      encoding: "utf8",
    }
  );

  stopContainer();

  if (testResult.status !== 0) {
    console.error("[STRICT_REDIS_RUNNER] Strict Redis integration test suite failed.");
    process.exit(testResult.status ?? 1);
  }

  console.log("[STRICT_REDIS_RUNNER] Strict Redis rate limiting proof suite PASSED.");
}

main().catch((err) => {
  stopContainer();
  console.error("[STRICT_REDIS_RUNNER] Unhandled error:", err);
  process.exit(1);
});
