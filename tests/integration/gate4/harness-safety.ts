import { URL } from "node:url";

export function sanitizeDatabaseUrl(urlStr?: string): string {
  if (!urlStr) return "";
  try {
    const u = new URL(urlStr);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return (urlStr ?? "").replace(/:([^@]+)@/, ":****@");
  }
}

export interface Gate4SafetyResult {
  ok: boolean;
  status: string;
  reason?: string;
  sanitizedUrl?: string;
}

export function validateGate4DatabaseSafety(env: Record<string, string | undefined> = process.env): Gate4SafetyResult {
  const optIn =
    env.KT_ALLOW_DATABASE_INTEGRATION_TESTS === "true" ||
    env.KT_ALLOW_DATABASE_INTEGRATION_TESTS === "1" ||
    env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "true" ||
    env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1" ||
    env.KT_GATE4_INTEGRATION_APPROVED === "true" ||
    env.KT_GATE4_INTEGRATION_APPROVED === "1";

  if (!optIn) {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: "Explicit integration test opt-in is required. Set KT_ALLOW_DATABASE_INTEGRATION_TESTS=true or KT_GATE4_INTEGRATION_APPROVED=1.",
    };
  }

  if (env.NODE_ENV === "production") {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: "Gate 4 integration tests are strictly forbidden when NODE_ENV=production.",
    };
  }

  const dbUrl = env.DATABASE_URL;
  if (!dbUrl || !dbUrl.trim()) {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: "DATABASE_URL environment variable is missing or empty.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: "DATABASE_URL is not a valid URL.",
    };
  }

  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "postgresql" && scheme !== "postgres") {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: `Non-PostgreSQL scheme rejected: '${scheme}:'`,
    };
  }

  const fullUrlLower = dbUrl.toLowerCase();
  const prohibitedKeywords = ["prod", "production", "staging", "rds.amazonaws.com", "cloudsql", "supabase.co", "neon.tech", "azure.com"];
  for (const kw of prohibitedKeywords) {
    if (fullUrlLower.includes(kw)) {
      return {
        ok: false,
        status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
        reason: `DATABASE_URL contains prohibited production host or keyword: '${kw}'.`,
      };
    }
  }

  const host = parsed.hostname.toLowerCase();
  const allowedHosts = ["localhost", "127.0.0.1", "::1"];
  if (!allowedHosts.includes(host)) {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: `Remote host rejected: '${host}'. Only local loopback hosts (localhost, 127.0.0.1, ::1) are permitted for Gate 4.`,
    };
  }

  const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
  if (!dbName) {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: "Database name in DATABASE_URL is empty.",
    };
  }

  const unsafeDbNames = ["kt_courier", "kt_courier_dev", "postgres", "main", "master"];
  if (unsafeDbNames.includes(dbName)) {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: `Default or persistent database name rejected: '${dbName}'. Gate 4 requires a disposable test database.`,
    };
  }

  const testMarkers = ["test", "integration", "phase2", "disposable", "ci", "e2e", "gate4", "demo_full"];
  const hasMarker = testMarkers.some((marker) => dbName.includes(marker));
  if (!hasMarker) {
    return {
      ok: false,
      status: "GATE4_INTEGRATION_STATUS=BLOCKED_SAFE_ENVIRONMENT_REQUIRED",
      reason: `Database name '${dbName}' lacks an explicit test marker (${testMarkers.join(", ")}).`,
    };
  }

  return {
    ok: true,
    status: "GATE4_INTEGRATION_STATUS=ALLOWED",
    sanitizedUrl: sanitizeDatabaseUrl(dbUrl),
  };
}
