import { URL } from "node:url";

export function isSafeLocalTestDatabaseUrl(dbUrl: string | undefined): boolean {
  if (!dbUrl || !dbUrl.trim()) return false;
  try {
    const parsed = new URL(dbUrl);
    const scheme = parsed.protocol.replace(":", "").toLowerCase();
    if (scheme !== "postgresql" && scheme !== "postgres") return false;

    const host = parsed.hostname.toLowerCase();
    const allowedHosts = ["localhost", "127.0.0.1", "::1", "db", "database", "postgres"];
    if (!allowedHosts.includes(host)) return false;

    const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
    if (!dbName) return false;

    const unsafeDbNames = ["kt_courier", "kt_courier_dev", "postgres", "dev", "production", "staging", "main", "master"];
    if (unsafeDbNames.includes(dbName)) return false;

    const testMarkers = ["test", "integration", "phase2", "disposable", "ci", "e2e", "demo", "demo_full"];
    if (!testMarkers.some((marker) => dbName.includes(marker))) return false;

    const fullUrlLower = dbUrl.toLowerCase();
    const prohibited = ["prod", "production", "live", "staging", "rds.amazonaws.com", "cloudsql", "supabase.co", "neon.tech", "azure.com"];
    if (prohibited.some((kw) => fullUrlLower.includes(kw))) return false;

    return true;
  } catch {
    return false;
  }
}

export function isLocalStorefrontValidationAllowed(env = process.env): boolean {
  if ((env.NODE_ENV as string) === "production" || (env.NODE_ENV as string) === "staging") return false;
  if (env.KT_LOCAL_STOREFRONT_VALIDATION !== "true" && env.KT_LOCAL_STOREFRONT_VALIDATION !== "1") return false;
  return isSafeLocalTestDatabaseUrl(env.DATABASE_URL);
}

export function isLocalCheckoutValidationAllowed(env = process.env): boolean {
  if ((env.NODE_ENV as string) === "production" || (env.NODE_ENV as string) === "staging") return false;
  if (env.KT_LOCAL_CHECKOUT_VALIDATION !== "true" && env.KT_LOCAL_CHECKOUT_VALIDATION !== "1") return false;
  return isSafeLocalTestDatabaseUrl(env.DATABASE_URL);
}
