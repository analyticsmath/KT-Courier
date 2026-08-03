import { readFileSync, existsSync } from "node:fs";
import net from "node:net";
import process from "node:process";

const ENV_FILE = ".env";
const TIMEOUT_MS = 2500;

function parseEnvFile(path) {
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

function loadDatabaseUrl() {
  const envVars = parseEnvFile(ENV_FILE);
  return process.env.DATABASE_URL || envVars.DATABASE_URL || null;
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function redactedUserInfo(url) {
  return {
    user: url.username ? "present/redacted" : "absent",
    password: url.password ? "present/redacted" : "absent",
  };
}

function connectionTargets(hostname) {
  if (hostname === "localhost") return ["localhost", "127.0.0.1", "::1"];
  return [hostname];
}

function testTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    function finish(ok, error) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, host, error });
    }

    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (error) => finish(false, error.code || error.message));
  });
}

async function main() {
  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    console.error("DATABASE_URL is missing.");
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    console.error("DATABASE_URL could not be parsed.");
    process.exit(1);
  }

  const port = parsed.port ? Number(parsed.port) : 5432;
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "(none)";
  const credentials = redactedUserInfo(parsed);

  console.log(`Database host: ${parsed.hostname}`);
  console.log(`Database port: ${port}`);
  console.log(`Database name: ${databaseName}`);
  console.log(`Database user: ${credentials.user}`);
  console.log(`Database password: ${credentials.password}`);
  console.log(`Database host is local: ${isLocalHost(parsed.hostname) ? "yes" : "no"}`);

  const attempts = [];
  for (const host of connectionTargets(parsed.hostname)) {
    attempts.push(await testTcp(host, port));
    if (attempts.at(-1).ok) break;
  }

  const success = attempts.find((attempt) => attempt.ok);
  if (success) {
    console.log(`TCP connectivity: reachable (${success.host}:${port})`);
    return;
  }

  const reasons = attempts
    .map((attempt) => `${attempt.host}:${port} ${attempt.error || "unreachable"}`)
    .join("; ");
  console.error(`TCP connectivity: unreachable (${reasons})`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`Database preflight failed: ${error.message}`);
  process.exit(1);
});
