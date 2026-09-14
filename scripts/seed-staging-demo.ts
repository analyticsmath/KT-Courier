/**
 * KT Couriers — Safe Staging Demonstration Database Provisioner
 * 
 * Non-destructive initial seeder for freshly provisioned staging-demo databases.
 * 
 * Safety Invariants:
 * 1. Requires explicit KT_RUNTIME_ENV=staging-demo.
 * 2. Requires KT_STAGING_DEMO_ENABLED=true.
 * 3. Requires KT_DATABASE_CLASSIFICATION=staging.
 * 4. Requires explicit authorization (KT_ALLOW_DEMO_SEED=true).
 * 5. Requires dedicated staging-demo database name (e.g. kt_courier_staging_demo),
 *    strictly refusing reserved primary databases (kt_courier_staging, kt_courier_production, kt_courier).
 * 6. Refuses production hosts or classifications.
 * 7. Comprehensive application emptiness verification: queries all tables in public schema
 *    (allowing only _prisma_migrations) and aborts if ANY business table contains data.
 * 8. Never drops schema or database; never truncates existing records.
 */

import { PrismaClient } from "@prisma/client";
import { URL } from "node:url";
import process from "node:process";
import { seedFullDemo } from "./seed-full-demo";

const RESERVED_DATABASES = new Set([
  "kt_courier",
  "kt_courier_dev",
  "kt_courier_development",
  "kt_courier_production",
  "kt_courier_staging",
  "postgres",
  "template1",
]);

const DEDICATED_STAGING_DEMO_PATTERN = /^kt_courier_staging_demo(?:_[a-z0-9_]+)?$/i;

export interface StagingSeedSafetyResult {
  valid: boolean;
  dbName: string;
  host: string;
  port: string;
}

export function validateStagingSeedSafety(
  env: Record<string, string | undefined> = process.env,
): StagingSeedSafetyResult {
  // 1. Runtime environment must be explicitly staging-demo
  const runtimeEnv = env.KT_RUNTIME_ENV?.trim().toLowerCase();
  if (runtimeEnv !== "staging-demo") {
    throw new Error(
      `Refusing staging seed: KT_RUNTIME_ENV must be explicitly 'staging-demo', got '${env.KT_RUNTIME_ENV}'.`
    );
  }

  // 2. Staging demo flag must be explicitly true
  if (env.KT_STAGING_DEMO_ENABLED?.trim().toLowerCase() !== "true") {
    throw new Error(
      "Refusing staging seed: KT_STAGING_DEMO_ENABLED must be 'true'."
    );
  }

  // 3. Database classification must be staging
  const dbClassification = env.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase();
  if (dbClassification !== "staging") {
    throw new Error(
      `Refusing staging seed: KT_DATABASE_CLASSIFICATION must be explicitly 'staging', got '${env.KT_DATABASE_CLASSIFICATION}'.`
    );
  }

  // 4. Explicit seed authorization required
  const allowSeed = env.KT_ALLOW_DEMO_SEED?.trim().toLowerCase();
  if (allowSeed !== "true" && allowSeed !== "1") {
    throw new Error(
      "Refusing staging seed: KT_ALLOW_DEMO_SEED must be explicitly set to 'true'."
    );
  }

  // 5. Inspect DATABASE_URL
  const rawDbUrl = env.DATABASE_URL?.trim();
  if (!rawDbUrl) {
    throw new Error("Refusing staging seed: DATABASE_URL is missing.");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawDbUrl);
  } catch {
    throw new Error("Refusing staging seed: DATABASE_URL is malformed.");
  }

  const host = parsed.hostname.toLowerCase();
  const fullLower = rawDbUrl.toLowerCase();

  // Refuse known production host markers
  const prodMarkers = ["rds.amazonaws.com", "cloudsql", "prod.", "production."];
  for (const marker of prodMarkers) {
    if (host.includes(marker) || fullLower.includes(marker)) {
      throw new Error(`Refusing staging seed against suspected production host '${host}'.`);
    }
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "")).trim();
  if (!dbName) {
    throw new Error("Refusing staging seed: database name could not be parsed from DATABASE_URL.");
  }

  // Refuse reserved primary databases
  if (RESERVED_DATABASES.has(dbName.toLowerCase())) {
    throw new Error(
      `Refusing staging seed on primary/reserved database '${dbName}'. A dedicated staging demo database name (matching ${DEDICATED_STAGING_DEMO_PATTERN.source}) is strictly required.`
    );
  }

  // Enforce dedicated staging-demo database pattern
  if (!DEDICATED_STAGING_DEMO_PATTERN.test(dbName)) {
    throw new Error(
      `Database '${dbName}' does not match dedicated staging demo database pattern (${DEDICATED_STAGING_DEMO_PATTERN.source}). Example: 'kt_courier_staging_demo'.`
    );
  }

  return {
    valid: true,
    dbName,
    host,
    port: parsed.port || "5432",
  };
}

/**
 * Asserts that the target database contains zero application business records.
 * Only the Prisma migrations tracking table (_prisma_migrations) is allowed to exist.
 */
export async function assertApplicationDatabaseEmpty(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != '_prisma_migrations';
  `;

  if (tables.length === 0) {
    console.log("  [Preflight] Schema is clean (0 application tables found).");
    return;
  }

  const populatedTables: Array<{ name: string; count: number }> = [];

  for (const { table_name } of tables) {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int as count FROM "${table_name}"`
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) {
      populatedTables.push({ name: table_name, count });
    }
  }

  if (populatedTables.length > 0) {
    const summary = populatedTables.map((t) => `${t.name}: ${t.count}`).join(", ");
    throw new Error(
      `Refusing staging seed: Target database is NOT empty. Existing business records found: [${summary}]. Staging seeding requires a fresh, unpopulated database and will never overwrite existing data.`
    );
  }

  console.log(`  [Preflight] Verified ${tables.length} application tables are empty. Target is a clean database.`);
}

export async function runStagingDemoSeed() {
  console.log("================================================================================");
  console.log("🛡️  KT COURIERS SAFE STAGING DEMONSTRATION PROVISIONER");
  console.log("================================================================================");

  // 1. Validate safety parameters
  const safety = validateStagingSeedSafety(process.env);
  console.log(`✓ Safety criteria satisfied for target database: ${safety.host}:${safety.port}/${safety.dbName}`);

  const prisma = new PrismaClient();

  try {
    // 2. Comprehensive application emptiness check
    console.log("[1/2] Verifying application database is completely empty...");
    await assertApplicationDatabaseEmpty(prisma);

    // 3. Execute non-destructive demo seed
    console.log("[2/2] Initiating clean demonstration universe seed...");
    await seedFullDemo();

    console.log("\n================================================================================");
    console.log("✅ STAGING DEMONSTRATION DATABASE PROVISIONING COMPLETE");
    console.log("================================================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module || process.argv[1]?.endsWith("seed-staging-demo.ts")) {
  runStagingDemoSeed().catch((err) => {
    console.error("\n❌ Staging seed aborted:", err.message || err);
    process.exit(1);
  });
}
