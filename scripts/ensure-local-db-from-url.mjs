import process from "node:process";
import { composeEnv, loadLocalEnv, runCompose, safeError, safeLog } from "./docker-common.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseLocalDatabaseUrl() {
  const env = loadLocalEnv();
  const value = env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is missing.");
  }

  const url = new URL(value);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to reconcile non-local database host: ${url.hostname}`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  if (!database || !user || !password) {
    throw new Error("DATABASE_URL must include database name, user, and password.");
  }

  return { database, user, password };
}

function tryAdminRole(role, settings, env) {
  const sql = `
SELECT format('CREATE ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
)\\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
)\\gexec

SELECT 'CREATE DATABASE ' || quote_ident(:'app_db') || ' OWNER ' || quote_ident(:'app_user')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'app_db'
)\\gexec

SELECT 'ALTER DATABASE ' || quote_ident(:'app_db') || ' OWNER TO ' || quote_ident(:'app_user')
WHERE EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'app_db'
)\\gexec
`;

  return runCompose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "--username",
      role,
      "--dbname",
      "postgres",
      "-v",
      `app_user=${settings.user}`,
      "-v",
      `app_password=${settings.password}`,
      "-v",
      `app_db=${settings.database}`,
    ],
    { input: sql, env }
  );
}

try {
  const settings = parseLocalDatabaseUrl();
  const env = composeEnv();
  const candidates = Array.from(
    new Set([settings.user, env.POSTGRES_USER, "kt_courier", "postgres"].filter(Boolean))
  );

  for (const role of candidates) {
    const result = tryAdminRole(role, settings, env);
    if (result.status === 0) {
      safeLog("Local database role and database are present for DATABASE_URL.");
      process.exit(0);
    }
  }

  safeError("Unable to reconcile local database role/database from DATABASE_URL.");
  process.exit(1);
} catch (error) {
  safeError(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
