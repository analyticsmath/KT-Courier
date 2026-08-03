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
  const detail = sanitize(result.stderr || result.stdout || "command failed");
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
