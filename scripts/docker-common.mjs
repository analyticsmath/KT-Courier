import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

export const composeFileArgs = ["-f", "compose.yml", "-f", "compose.dev.yml"];
export const normalComposeProject = "kt-couriers";

export function composeArgs(args = [], options = {}) {
  const result = ["compose"];
  if (options.projectName) {
    result.push("-p", options.projectName);
  }
  if (existsSync(".env.docker")) {
    result.push("--env-file", ".env.docker");
  }
  result.push(...composeFileArgs, ...args);
  return result;
}

export function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    encoding: options.encoding ?? "utf8",
    input: options.input,
    shell: false,
    stdio: options.stdio ?? "pipe",
  });
}

export function runDocker(args, options = {}) {
  return run("docker", args, options);
}

export function runCompose(args, options = {}) {
  return runDocker(composeArgs(args, options), {
    ...options,
    env: options.env ?? composeEnv(),
  });
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function isSchemaDiffVerbose(env = process.env) {
  const value = env?.KT_SCHEMA_DIFF_VERBOSE;
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function getSchemaVerifierComposeArgs(env = process.env) {
  const args = ["run", "--rm"];
  if (isSchemaDiffVerbose(env)) {
    args.push("-e", "KT_SCHEMA_DIFF_VERBOSE=1");
  }
  args.push("migrate", "node", "scripts/verify-database-schema.mjs");
  return args;
}

/**
 * Validates that the execution context matches a disposable smoke test environment
 * before granting seed authorization.
 *
 * @param {string} projectName
 * @param {Record<string, string | undefined>} [env]
 */
export function assertDisposableGate4Identity(projectName, env = process.env) {
  if (projectName === normalComposeProject || !/^kt-couriers-(gate4|ci-gate4)/.test(projectName)) {
    throw new Error(`Refusing execution for non-disposable Gate 4 Compose project '${projectName}'.`);
  }

  const dbName = env?.POSTGRES_DB;
  if (!dbName || !/^kt_courier_gate4_disposable/.test(dbName)) {
    throw new Error(`Refusing execution for non-disposable Gate 4 database '${dbName}'.`);
  }

  const dbUrl = env?.DATABASE_URL;
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const host = parsed.hostname;
      if (!["db", "localhost", "127.0.0.1", "::1"].includes(host)) {
        throw new Error(`Refusing execution for non-local database host '${host}'.`);
      }
      if (parsed.pathname.includes("prod") || parsed.pathname.includes("staging")) {
        throw new Error("Refusing execution for production/staging database in URL.");
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Refusing")) throw e;
    }
  }
}

export function assertDisposableSmokeIdentity(projectName, env = process.env) {
  if (projectName === normalComposeProject || !/^kt-couriers-(baseline-smoke|ci-)/.test(projectName)) {
    throw new Error(`Refusing seed authorization for non-disposable Compose project '${projectName}'.`);
  }

  const dbName = env?.POSTGRES_DB;
  if (!dbName || !/^kt_courier_(baseline_smoke|smoke)/.test(dbName)) {
    throw new Error(`Refusing seed authorization for non-disposable database '${dbName}'.`);
  }

  const dbUrl = env?.DATABASE_URL;
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const host = parsed.hostname;
      if (!["db", "localhost", "127.0.0.1", "::1"].includes(host)) {
        throw new Error(`Refusing seed authorization for non-local database host '${host}'.`);
      }
      if (parsed.pathname.includes("prod") || parsed.pathname.includes("staging")) {
        throw new Error("Refusing seed authorization for production/staging database in URL.");
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Refusing")) throw e;
    }
  }
}

/**
 * Returns Compose arguments for running the seed in a disposable smoke environment.
 * Injects explicit authorization (-e KT_ALLOW_DEMO_SEED=true) strictly for this command.
 *
 * @param {{ service?: string, command?: string[] }} [options]
 * @returns {string[]}
 */
export function getDisposableSmokeSeedComposeArgs({
  service = "seed",
  command = [],
} = {}) {
  return [
    "run",
    "--rm",
    "-e",
    "KT_ALLOW_DEMO_SEED=true",
    service,
    ...command,
  ];
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseEnvFile(path) {
  if (!existsSync(path)) return {};

  const vars = {};
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

export function loadLocalEnv() {
  return {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.docker"),
    ...process.env,
  };
}

function databaseSettingsFromUrl(value) {
  if (!value) return {};
  try {
    const url = new URL(value);
    if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return {};
    return {
      POSTGRES_DB: decodeURIComponent(url.pathname.replace(/^\//, "")),
      POSTGRES_USER: decodeURIComponent(url.username),
      POSTGRES_PASSWORD: decodeURIComponent(url.password),
      POSTGRES_PORT: url.port || "5432",
    };
  } catch {
    return {};
  }
}

function shadowSettingsFromUrl(value) {
  if (!value) return {};
  try {
    const url = new URL(value);
    if (!["localhost", "127.0.0.1", "::1", "db"].includes(url.hostname)) return {};
    return {
      SHADOW_POSTGRES_DB: decodeURIComponent(url.pathname.replace(/^\//, "")),
    };
  } catch {
    return {};
  }
}

export function composeEnv(baseEnv = process.env) {
  const localEnv = {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.docker"),
    ...baseEnv,
  };

  return {
    ...localEnv,
    ...databaseSettingsFromUrl(localEnv.DATABASE_URL),
    ...shadowSettingsFromUrl(localEnv.SHADOW_DATABASE_URL),
  };
}

export function collectSecrets(env = loadLocalEnv()) {
  return [
    env.DATABASE_URL,
    env.SHADOW_DATABASE_URL,
    env.CONTAINER_DATABASE_URL,
    env.CONTAINER_SHADOW_DATABASE_URL,
    env.POSTGRES_PASSWORD,
    env.RESEND_API_KEY,
    env.GOOGLE_MAPS_SERVER_KEY,
  ].filter(Boolean);
}

export function sanitize(value, extraSecrets = []) {
  let output = String(value ?? "");
  output = output.replace(/\0/g, "");
  for (const secret of [...collectSecrets(), ...extraSecrets]) {
    if (secret) {
      output = output.split(secret).join("[redacted]");
    }
  }
  output = output.replace(
    /postgresql:\/\/([^:\s/@]+):([^@\s/]+)@/gi,
    "postgresql://$1:[redacted]@"
  );
  output = output.replace(
    /(DATABASE_URL|SHADOW_DATABASE_URL|CONTAINER_DATABASE_URL|CONTAINER_SHADOW_DATABASE_URL)=("[^"]*"|'[^']*'|[^\s]+)/gi,
    "$1=[redacted]"
  );
  output = output.replace(
    /(POSTGRES_PASSWORD|RESEND_API_KEY|GOOGLE_MAPS_SERVER_KEY)=("[^"]*"|'[^']*'|[^\s]+)/gi,
    "$1=[redacted]"
  );
  output = output.replace(
    /(\b(?:POSTGRES_PASSWORD|RESEND_API_KEY|GOOGLE_MAPS_SERVER_KEY):\s*)("[^"]*"|'[^']*'|[^\r\n]+)/gi,
    "$1[redacted]"
  );
  return output;
}

export function safeLog(value = "") {
  const text = sanitize(value).trimEnd();
  if (text) console.log(text);
}

export function safeError(value = "") {
  const text = sanitize(value).trimEnd();
  if (text) console.error(text);
}

export function assertSuccess(result, label) {
  if (result.status === 0) return;
  const detail =
    [result.stdout, result.stderr]
      .filter(Boolean)
      .map((value) => sanitize(value))
      .filter(Boolean)
      .join("\n") || "command failed";
  throw new Error(`${label} failed: ${detail}`);
}

export function getServiceContainerId(service, options = {}) {
  const result = runCompose(["ps", "-q", service], options);
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

export function getContainerHealth(containerId, env = process.env) {
  if (!containerId) return "missing";
  const result = runDocker(
    [
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
      containerId,
    ],
    { env }
  );
  if (result.status !== 0) return "unknown";
  return result.stdout.trim() || "unknown";
}

export async function waitForServiceHealth(service, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 2_500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const containerId = getServiceContainerId(service, options);
    const status = getContainerHealth(containerId, options.env);
    if (status === "healthy" || status === "running") {
      return status;
    }
    await wait(intervalMs);
  }

  const containerId = getServiceContainerId(service, options);
  return getContainerHealth(containerId, options.env);
}

export async function waitForHttp(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const expectedStatus = options.expectedStatus ?? 200;
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "not attempted";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      lastStatus = `${response.status}`;
      if (response.status === expectedStatus) {
        return { ok: true, status: response.status };
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : "request failed";
    }
    await wait(intervalMs);
  }

  return { ok: false, status: lastStatus };
}
