import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { URL } from "node:url";

/**
 * Redacts passwords from database URL strings for safe output and logging.
 */
export function sanitizeDbUrl(urlStr) {
  if (!urlStr) return "";
  try {
    const u = new URL(urlStr);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return urlStr.replace(/:([^@]+)@/, ":****@");
  }
}

/**
 * Validates environmental safety prerequisites for isolated PostgreSQL test runs.
 */
export function validateSafePostgresEnv(env = process.env, suiteKey = "CATALOG") {
  const suiteOptInKey = `KT_${suiteKey}_INTEGRATION_APPROVED`;
  const suiteOptIn = env[suiteOptInKey] === "1" || env[suiteOptInKey] === "true";
  const globalOptIn = env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1" || env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "true";

  if (!suiteOptIn && !globalOptIn) {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: `Explicit test opt-in is required. Set KT_ALLOW_ISOLATED_POSTGRES_TESTS=1 or ${suiteOptInKey}=1.`,
    };
  }

  if (env.NODE_ENV === "production") {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: "Execution is strictly blocked when NODE_ENV=production.",
    };
  }

  const dbUrl = env.DATABASE_URL;
  if (!dbUrl || !dbUrl.trim()) {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: "DATABASE_URL environment variable is missing or empty.",
    };
  }

  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: "DATABASE_URL is not a valid URL.",
    };
  }

  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "postgresql" && scheme !== "postgres") {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: `Non-PostgreSQL scheme rejected: '${scheme}:'`,
    };
  }

  const fullUrlLower = dbUrl.toLowerCase();
  const prohibitedKeywords = ["prod", "production", "live", "staging", "rds.amazonaws.com", "cloudsql", "supabase.co", "neon.tech", "azure.com"];
  for (const kw of prohibitedKeywords) {
    if (fullUrlLower.includes(kw)) {
      return {
        ok: false,
        status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
        reason: `DATABASE_URL contains prohibited production or cloud host identifier: '${kw}'.`,
      };
    }
  }

  const host = parsed.hostname.toLowerCase();
  const allowedHosts = ["localhost", "127.0.0.1", "::1"];
  if (!allowedHosts.includes(host)) {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: `Remote or non-loopback host rejected: '${host}'. Only local hosts (localhost, 127.0.0.1, ::1) are permitted.`,
    };
  }

  const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
  if (!dbName) {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: "Database name in DATABASE_URL is empty.",
    };
  }

  const unsafeDbNames = ["kt_courier", "kt_courier_dev", "postgres", "dev", "production", "staging", "main", "master"];
  if (unsafeDbNames.includes(dbName)) {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: `Default or non-test database name rejected: '${dbName}'.`,
    };
  }

  const testMarkers = ["test", "integration", "phase2", "disposable", "ci", "e2e"];
  const hasMarker = testMarkers.some((marker) => dbName.includes(marker));
  if (!hasMarker) {
    return {
      ok: false,
      status: `${suiteKey}_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED`,
      reason: `Database name '${dbName}' lacks an explicit test marker (test, integration, phase2, disposable, ci).`,
    };
  }

  return {
    ok: true,
    sanitizedUrl: sanitizeDbUrl(dbUrl),
    parsed,
  };
}

/**
 * Checks TCP socket connectivity to the target database host and port.
 */
export function checkDatabaseTcpConnection(hostname, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(result);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));

    socket.connect(Number(port) || 5432, hostname);
  });
}

/**
 * Executes a PostgreSQL integration test runner safely.
 * Does NOT create, drop, reset, migrate, seed, or start Docker containers.
 */
export async function runSafePostgresIntegrationSuite({
  suiteKey,
  configFile,
  env = process.env,
  runnerMode = "cli",
}) {
  const validation = validateSafePostgresEnv(env, suiteKey);

  if (!validation.ok) {
    if (runnerMode === "cli") {
      console.log(validation.status);
      console.error(`[SAFE_POSTGRES_RUNNER] ${validation.reason}`);
    }
    return { exitCode: 2, status: validation.status, reason: validation.reason };
  }

  const hostname = validation.parsed.hostname;
  const port = validation.parsed.port || "5432";
  const isReachable = await checkDatabaseTcpConnection(hostname, port);

  if (!isReachable) {
    const status = `${suiteKey}_INTEGRATION_STATUS=BLOCKED_DATABASE_UNAVAILABLE`;
    const reason = `Database host ${hostname}:${port} is not reachable. Prepare an isolated local test PostgreSQL instance first.`;
    if (runnerMode === "cli") {
      console.log(status);
      console.error(`[SAFE_POSTGRES_RUNNER] ${reason}`);
    }
    return { exitCode: 2, status, reason };
  }

  if (runnerMode === "cli") {
    console.log(`[SAFE_POSTGRES_RUNNER] Target database verified: ${validation.sanitizedUrl}`);
    console.log(`[SAFE_POSTGRES_RUNNER] Running Vitest config: ${configFile}`);
  }

  const result = spawnSync(
    process.execPath,
    [path.join("node_modules", "vitest", "vitest.mjs"), "run", "--config", configFile],
    {
      cwd: process.cwd(),
      env: { ...env, DATABASE_URL: env.DATABASE_URL },
      stdio: "inherit",
      shell: false,
    }
  );

  const exitCode = result.status ?? 1;
  const status = exitCode === 0 ? `${suiteKey}_INTEGRATION_STATUS=PASSED` : `${suiteKey}_INTEGRATION_STATUS=FAILED`;

  if (runnerMode === "cli") {
    console.log(status);
  }

  return { exitCode, status };
}
