import process from "node:process";
import {
  composeEnv,
  runCompose,
  safeError,
  safeLog,
  sanitize,
} from "./docker-common.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db"]);

function databaseNameFromUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!LOCAL_HOSTS.has(url.hostname)) {
      throw new Error(`Refusing to manage a non-local shadow database host: ${url.hostname}`);
    }
    return decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
    return null;
  }
}

const env = composeEnv();
const postgresDb = env.POSTGRES_DB || "kt_courier_dev";
const postgresUser = env.POSTGRES_USER || "kt_courier";
const shadowDb =
  env.SHADOW_POSTGRES_DB ||
  databaseNameFromUrl(env.SHADOW_DATABASE_URL) ||
  "kt_courier_shadow";

if (!shadowDb) {
  console.error("Shadow database name is missing.");
  process.exit(1);
}

try {
  databaseNameFromUrl(env.SHADOW_DATABASE_URL);
} catch (error) {
  safeError(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const sql = `
SELECT 'CREATE DATABASE ' || quote_ident(:'shadow_db')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'shadow_db'
)\\gexec
`;

const result = runCompose(
  [
    "exec",
    "-T",
    "db",
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "--username",
    postgresUser,
    "--dbname",
    postgresDb,
    "-v",
    `shadow_db=${shadowDb}`,
  ],
  { input: sql }
);

if (result.status !== 0) {
  safeError(result.stderr || result.stdout || "Unable to ensure local shadow database.");
  process.exit(result.status ?? 1);
}

safeLog(`Shadow database is present: ${sanitize(shadowDb)}`);
