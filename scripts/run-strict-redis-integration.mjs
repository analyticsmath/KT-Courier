import { spawnSync } from "node:child_process";
import process from "node:process";
import Redis from "ioredis";
import { findAvailableLoopbackPort, isHostPortBindingConflict } from "./docker-common.mjs";

let containerName = `kt-redis-strict-acceptance-${Date.now()}-${process.pid}`;

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8" });
}

function stopContainer(name = containerName) {
  try {
    run("docker", ["stop", name]);
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

async function startRedisWithPortRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const port = process.env.KT_STRICT_REDIS_PORT
      ? Number(process.env.KT_STRICT_REDIS_PORT)
      : await findAvailableLoopbackPort();
    containerName = `kt-redis-strict-acceptance-${Date.now()}-${process.pid}-${attempt}`;
    const redisUrl = `redis://127.0.0.1:${port}`;

    console.log(`[STRICT_REDIS_RUNNER] Starting disposable Redis container '${containerName}' on port ${port}...`);

    const launch = run("docker", [
      "run",
      "--rm",
      "-d",
      "--name",
      containerName,
      "-p",
      `127.0.0.1:${port}:6379`,
      "redis:7-alpine",
    ]);

    if (launch.status === 0) {
      const ready = await waitForRedis(redisUrl, 20000);
      if (ready) {
        return { port, containerName, redisUrl };
      }
      stopContainer(containerName);
      throw new Error("Redis container did not respond to PONG within timeout.");
    }

    const output = (launch.stderr || "") + "\n" + (launch.stdout || "");
    const isConflict = isHostPortBindingConflict(output);
    stopContainer(containerName);

    if (isConflict && !process.env.KT_STRICT_REDIS_PORT && attempt < maxAttempts) {
      console.log(`[STRICT_REDIS_RUNNER] Port ${port} collision on attempt ${attempt}/${maxAttempts}. Retrying with fresh loopback port...`);
      continue;
    }

    throw new Error(`Failed to start Docker Redis container on attempt ${attempt}: ${output.trim()}`);
  }
  throw new Error(`Failed to start Redis after ${maxAttempts} attempts.`);
}

async function main() {
  const { redisUrl } = await startRedisWithPortRetry(3);

  console.log(`[STRICT_REDIS_RUNNER] Disposable Redis is healthy at ${redisUrl}. Running strict test suite...`);

  const testEnv = {
    ...process.env,
    REDIS_URL: redisUrl,
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
