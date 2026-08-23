import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import {
  assertSuccess,
  normalComposeProject,
  runCompose,
  runDocker,
  safeError,
  safeLog,
  waitForServiceHealth,
} from "./docker-common.mjs";

const suite = process.argv[2];
const suiteFiles = {
  auth: ["tests/integration/auth-session.integration.test.ts"],
  permissions: ["tests/integration/permissions.integration.test.ts"],
  orders: ["tests/integration/orders-pricing.integration.test.ts"],
  pricing: ["tests/integration/pricing-quote.integration.test.ts", "tests/integration/pricing-concurrency.integration.test.ts"],
  dispatch: ["tests/integration/dispatch-concurrency.integration.test.ts", "tests/integration/dispatch-lifecycle.integration.test.ts"],
  "cross-module": ["tests/integration/phase7-5-cross-module.integration.test.ts"],
};

if (!suiteFiles[suite]) {
  safeError("A supported live integration suite is required.");
  process.exit(1);
}

const nonce = `${Date.now()}-${process.pid}`;
const projectName = `kt-couriers-ci-phase75-${suite}-${nonce}`;
const database = `kt_phase75_${suite.replace(/[^a-z0-9]/g, "_")}`;
const password = "phase75_disposable_only";

export async function findAvailableLoopbackPort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(
      {
        host: "127.0.0.1",
        port: 0,
        exclusive: true,
      },
      () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          server.close(() => reject(new Error("Unable to allocate loopback port.")));
          return;
        }
        const port = address.port;
        server.close((error) => {
          if (error) reject(error);
          else resolve(port);
        });
      }
    );
  });
}

function buildEnv(port) {
  return {
    ...process.env,
    POSTGRES_DB: database,
    POSTGRES_USER: database,
    POSTGRES_PASSWORD: password,
    SHADOW_POSTGRES_DB: `${database}_shadow`,
    POSTGRES_PORT: String(port),
    DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}?schema=public`,
    SHADOW_DATABASE_URL: `postgresql://${database}:${password}@localhost:${port}/${database}_shadow?schema=public`,
    EMAIL_PROVIDER: "console",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    KT_ALLOW_DEMO_SEED: "true",
    KT_DATABASE_CLASSIFICATION: "development",
  };
}

let env = buildEnv(5432);

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-ci-phase75-/.test(projectName)) {
    throw new Error("Refusing to remove a non-disposable integration project.");
  }
}

function runVitest() {
  const result = spawnSync(process.execPath, [path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", "vitest.integration.config.ts", ...suiteFiles[suite]], {
    cwd: process.cwd(),
    env,
    shell: false,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${suite} live integration tests failed.`);
}

async function cleanup() {
  if (!env) return;
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "Disposable integration cleanup failed.");
}

async function startDatabaseWithPortRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const selectedPort = await findAvailableLoopbackPort();
    env = buildEnv(selectedPort);
    assertSuccess(runCompose(["config", "--quiet"], { projectName, env }), "integration compose config");
    const upResult = runCompose(["up", "-d", "db"], { projectName, env });
    if (upResult.status === 0) {
      return;
    }

    const output = (upResult.stderr || "") + "\n" + (upResult.stdout || "");
    const isPortCollision = /ports are not available|bind: An attempt was made to access a socket|port is already allocated/i.test(output);

    runCompose(["down", "-v", "--remove-orphans"], { projectName, env });

    if (isPortCollision && attempt < maxAttempts) {
      safeLog(`Port ${selectedPort} binding conflict on attempt ${attempt}/${maxAttempts}. Retrying with fresh loopback port...`);
      continue;
    }

    throw new Error(`integration database startup failed on attempt ${attempt}: ${output.trim()}`);
  }
}

let failed = false;
try {
  assertDisposableProject();
  safeLog(`Live integration suite: ${suite}.`);
  assertSuccess(runDocker(["info"]), "docker info");
  await startDatabaseWithPortRetry(3);
  const health = await waitForServiceHealth("db", { projectName, env, timeoutMs: 150_000 });
  if (health !== "healthy") throw new Error(`integration database did not become healthy (${health}).`);
  assertSuccess(runCompose(["run", "--build", "--rm", "migrate"], { projectName, env }), "integration migration deploy");
  assertSuccess(runCompose(["run", "--rm", "seed"], { projectName, env }), "integration seed");
  runVitest();
  safeLog(`Live ${suite} integration suite passed.`);
} catch (error) {
  failed = true;
  safeError(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}

process.exit(failed ? 1 : 0);
