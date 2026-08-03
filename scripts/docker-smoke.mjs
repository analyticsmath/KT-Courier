import process from "node:process";
import {
  assertSuccess,
  normalComposeProject,
  runCompose,
  runDocker,
  safeError,
  safeLog,
  waitForHttp,
  waitForServiceHealth,
} from "./docker-common.mjs";

const projectName = process.env.KT_SMOKE_PROJECT_NAME || "kt-couriers-baseline-smoke";
const smokeEnv = {
  ...process.env,
  POSTGRES_DB: "kt_courier_baseline_smoke",
  POSTGRES_USER: "kt_courier_baseline_smoke",
  POSTGRES_PASSWORD: "smoke_local_only_password",
  SHADOW_POSTGRES_DB: "kt_courier_baseline_smoke_shadow",
  POSTGRES_PORT: "55433",
  APP_PORT: "3100",
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
  EMAIL_PROVIDER: "console",
};

function assertDisposableProject() {
  if (projectName === normalComposeProject || !/^kt-couriers-(baseline-smoke|ci-)/.test(projectName)) {
    throw new Error(`Refusing to remove volumes for non-disposable Compose project ${projectName}.`);
  }
}

function readSeedState() {
  const result = runCompose(
    [
      "exec",
      "-T",
      "db",
      "sh",
      "-lc",
      "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc \"SELECT 'permissions=' || count(*) FROM \\\"Permission\\\"; SELECT 'admin_role_grants=' || count(*) FROM \\\"RolePermission\\\" WHERE role = 'ADMIN' AND enabled; SELECT 'legacy_subscription_plans=' || count(*) FROM \\\"LegacySubscriptionPlan\\\"; SELECT 'ad_placements=' || count(*) FROM \\\"AdPlacement\\\"; SELECT 'platform_wallets=' || count(*) FROM \\\"Wallet\\\" WHERE \\\"ownerType\\\" = 'PLATFORM' AND \\\"ownerId\\\" = 'platform';\"",
    ],
    { projectName, env: smokeEnv }
  );
  assertSuccess(result, "seed state inspection");
  return result.stdout.trim();
}

async function cleanup() {
  safeLog("Docker smoke: removing only the disposable smoke project volume.");
  const result = runCompose(["down", "-v", "--remove-orphans"], { projectName, env: smokeEnv });
  if (result.status !== 0) safeError(result.stderr || result.stdout || "Smoke cleanup failed.");
}

async function main() {
  assertDisposableProject();
  const baseUrl = `http://localhost:${smokeEnv.APP_PORT}`;

  safeLog(`Docker smoke project: ${projectName}`);
  assertSuccess(runDocker(["info"]), "docker info");
  assertSuccess(runCompose(["config", "--quiet"], { projectName, env: smokeEnv }), "compose config");
  assertSuccess(runCompose(["build"], { projectName, env: smokeEnv }), "docker compose build");
  assertSuccess(runCompose(["up", "-d", "db"], { projectName, env: smokeEnv }), "smoke db startup");

  const dbHealth = await waitForServiceHealth("db", {
    projectName,
    env: smokeEnv,
    timeoutMs: 150_000,
  });
  if (dbHealth !== "healthy") throw new Error(`db did not become healthy; final status: ${dbHealth}`);

  assertSuccess(runCompose(["run", "--rm", "migrate"], { projectName, env: smokeEnv }), "migrate service");
  assertSuccess(
    runCompose(["run", "--rm", "migrate", "npx", "prisma", "migrate", "status"], {
      projectName,
      env: smokeEnv,
    }),
    "migration status"
  );
  assertSuccess(
    runCompose(
      [
        "run",
        "--rm",
        "migrate",
        "sh",
        "-lc",
        "npx prisma migrate diff --from-url \"$DATABASE_URL\" --to-schema-datamodel prisma/schema.prisma --exit-code",
      ],
      { projectName, env: smokeEnv }
    ),
    "database-to-schema diff"
  );

  assertSuccess(runCompose(["run", "--rm", "seed"], { projectName, env: smokeEnv }), "first seed service");
  const firstSeedState = readSeedState();
  assertSuccess(runCompose(["run", "--rm", "seed"], { projectName, env: smokeEnv }), "second seed service");
  const secondSeedState = readSeedState();
  if (firstSeedState !== secondSeedState) throw new Error("Seed changed idempotent record counts on its second run.");
  safeLog(`Seed verification: ${secondSeedState}`);

  assertSuccess(runCompose(["up", "-d", "--build"], { projectName, env: smokeEnv }), "full application stack startup");

  const appHealth = await waitForServiceHealth("app", {
    projectName,
    env: smokeEnv,
    timeoutMs: 180_000,
  });
  if (appHealth !== "healthy") throw new Error(`app did not become healthy; final status: ${appHealth}`);

  const health = await waitForHttp(`${baseUrl}/api/health`, { timeoutMs: 60_000 });
  if (!health.ok) throw new Error(`/api/health did not return 200; final status: ${health.status}`);

  const ready = await waitForHttp(`${baseUrl}/api/ready`, { timeoutMs: 60_000 });
  if (!ready.ok) throw new Error(`/api/ready did not return 200; final status: ${ready.status}`);

  const runtimeUser = runCompose(["exec", "-T", "app", "id"], { projectName, env: smokeEnv });
  assertSuccess(runtimeUser, "non-root runtime inspection");
  if (!/uid=1001\(nextjs\)/.test(runtimeUser.stdout)) throw new Error("Application container is not running as nextjs.");

  safeLog("Docker smoke passed.");
}

let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  safeError(error instanceof Error ? error.message : String(error));
  safeError("Recent service logs:");
  const logs = runCompose(["logs", "--tail=120"], { projectName, env: smokeEnv });
  if (logs.stdout) safeError(logs.stdout);
  if (logs.stderr) safeError(logs.stderr);
} finally {
  await cleanup();
}

process.exit(failed ? 1 : 0);
