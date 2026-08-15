import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { runCompose } from "./docker-common.mjs";

const root = process.cwd();
const migrationsDir = path.join(root, "prisma", "migrations");

function log(msg) {
  console.log(`[MIGRATION_UPGRADE_PROOF] ${msg}`);
}

function parseRootUrl(originalUrl) {
  const url = new URL(originalUrl);
  url.pathname = "/postgres";
  return url.toString();
}

function buildDbUrl(rootUrl, dbName) {
  const url = new URL(rootUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function runPrismaCli(args, dbUrl) {
  const result = spawnSync("npx", args, {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
    encoding: "utf8",
    shell: true,
  });
  return result;
}

async function main() {
  const baseDatabaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://kt_courier:change_me_local_only@localhost:5433/kt_courier_demo_full?schema=public";

  log("Starting historical database upgrade proof...");

  // Ensure kt_courier user has CREATEDB privilege
  runCompose([
    "exec",
    "-u",
    "postgres",
    "-T",
    "db",
    "psql",
    "-U",
    "postgres",
    "-d",
    "kt_courier_dev",
    "-c",
    "ALTER USER kt_courier CREATEDB;",
  ]);

  const rootUrl = parseRootUrl(baseDatabaseUrl);
  const rootPrisma = new PrismaClient({
    datasources: { db: { url: rootUrl } },
  });

  // Verify connection to PostgreSQL
  try {
    await rootPrisma.$queryRaw`SELECT 1`;
    log("PostgreSQL server is connected and ready.");
  } catch (err) {
    console.error(
      "[MIGRATION_UPGRADE_PROOF_ERROR] PostgreSQL connection failed on:",
      rootUrl,
      err
    );
    process.exit(1);
  }

  const nonce = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const disposableDbName = `kt_migration_upgrade_${nonce}`;
  const testDbUrl = buildDbUrl(baseDatabaseUrl, disposableDbName);

  let testPrisma = null;

  try {
    log(`Creating disposable database: ${disposableDbName}`);
    await rootPrisma.$executeRawUnsafe(`CREATE DATABASE "${disposableDbName}"`);

    testPrisma = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });
    await testPrisma.$queryRaw`SELECT 1`;

    // 1. Discover all migration directories
    const allEntries = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const forwardMigrationName =
      "20260815040000_phase_1_managed_marketing_package_lifecycle";
    const historicalMigrations = allEntries.filter(
      (name) => name < forwardMigrationName
    );

    log(
      `Discovered ${historicalMigrations.length} historical migrations (1 through 62).`
    );
    if (historicalMigrations.length !== 62) {
      throw new Error(
        `Expected exactly 62 historical migrations before Phase 1 forward migration, found ${historicalMigrations.length}`
      );
    }

    // 2. Initialize _prisma_migrations table
    await testPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 3. Apply historical migrations 1..62 sequentially
    log("Applying historical migrations 1 through 62 sequentially...");
    for (const migrationName of historicalMigrations) {
      const sqlPath = path.join(migrationsDir, migrationName, "migration.sql");
      const sqlContent = readFileSync(sqlPath, "utf8");
      const checksum = createHash("sha256").update(sqlContent).digest("hex");

      // Execute migration SQL via psql in container
      const execResult = runCompose(
        [
          "exec",
          "-T",
          "db",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "kt_courier",
          "-d",
          disposableDbName,
        ],
        { input: sqlContent }
      );

      if (execResult.status !== 0) {
        throw new Error(
          `Failed executing migration ${migrationName}:\n${execResult.stderr || execResult.stdout}`
        );
      }

      // Record in _prisma_migrations
      await testPrisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES (gen_random_uuid()::text, $1, now(), $2, null, null, now(), 1)`,
        checksum,
        migrationName
      );
    }
    log("Successfully applied and recorded all 62 historical migrations.");

    // Verify migration count in _prisma_migrations
    const countResult = await testPrisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL
    `;
    const recordedCount = Number(countResult[0]?.count ?? 0);
    log(`Recorded historical migrations in _prisma_migrations: ${recordedCount}`);
    if (recordedCount !== 62) {
      throw new Error(`Expected 62 recorded migrations, got ${recordedCount}`);
    }

    // 4. Seed ACTIVE ManagedMarketingPackageVersion in historical state
    log("Seeding ACTIVE ManagedMarketingPackageVersion in historical pre-Phase 1 state...");
    const pkgId = `pkg_hist_${nonce}`;
    const pkgRef = `MMP-HIST-${nonce}`;
    const pkgCode = `MMP-CODE-${nonce}`;

    await testPrisma.$executeRawUnsafe(
      `INSERT INTO "ManagedMarketingPackageVersion" (
        "id", "publicReference", "code", "versionNumber", "name", "description",
        "sortOrder", "status", "channel", "packageTerms", "durationDays",
        "postCount", "videoCount", "storyCount", "priceAmount", "taxRate",
        "currency", "effectiveAt", "createdAt"
      ) VALUES (
        $1, $2, $3, 1, 'Historical Package', 'Description',
        0, 'ACTIVE', 'FACEBOOK', '{"tier":"standard"}'::jsonb, 30,
        1, 1, 1, 150.00, 0.1500,
        'ZAR', now(), now()
      )`,
      pkgId,
      pkgRef,
      pkgCode
    );
    log("Seeded ACTIVE package version successfully.");

    // 5. Verify ACTIVE -> RETIRED FAILS under pre-Phase 1 trigger
    log("Verifying ACTIVE -> RETIRED fails under pre-Phase 1 trigger...");
    let prePhase1Failed = false;
    try {
      await testPrisma.$executeRawUnsafe(
        `UPDATE "ManagedMarketingPackageVersion" SET "status" = 'RETIRED' WHERE "id" = $1`,
        pkgId
      );
    } catch (err) {
      prePhase1Failed = true;
      log(`Pre-Phase 1 update was rejected as expected: ${err.message || err}`);
    }

    if (!prePhase1Failed) {
      throw new Error(
        "Pre-Phase 1 invariant violation: ACTIVE -> RETIRED was unexpectedly allowed under historical triggers!"
      );
    }

    // 6. Deploy Phase 1 Forward Migration (Migration 63) via Prisma Migrate Deploy
    log(
      "Deploying forward migration 63 (20260815040000_phase_1_managed_marketing_package_lifecycle)..."
    );
    const deployResult = runPrismaCli(["prisma", "migrate", "deploy"], testDbUrl);
    if (deployResult.status !== 0) {
      throw new Error(
        `prisma migrate deploy failed:\n${deployResult.stderr || deployResult.stdout}`
      );
    }
    log(`prisma migrate deploy output:\n${(deployResult.stdout || "").trim()}`);

    // 7. Verify migration status has no divergence / drift
    log("Verifying migration status via npx prisma migrate status...");
    const statusResult = runPrismaCli(["prisma", "migrate", "status"], testDbUrl);
    const statusOutput = `${statusResult.stdout || ""} ${statusResult.stderr || ""}`;
    log(`prisma migrate status output:\n${statusOutput.trim()}`);
    if (
      statusResult.status !== 0 ||
      (!statusOutput.includes("Database schema is up to date") &&
        !statusOutput.includes("No pending migrations"))
    ) {
      throw new Error(
        `prisma migrate status detected divergence or unapplied migrations:\n${statusOutput}`
      );
    }

    // 8. Verify ACTIVE -> RETIRED now SUCCEEDS under post-Phase 1 trigger
    log("Verifying ACTIVE -> RETIRED now succeeds post-Phase 1 deployment...");
    await testPrisma.$executeRawUnsafe(
      `UPDATE "ManagedMarketingPackageVersion" SET "status" = 'RETIRED' WHERE "id" = $1`,
      pkgId
    );

    const postUpdateRows = await testPrisma.$queryRaw`
      SELECT "status" FROM "ManagedMarketingPackageVersion" WHERE "id" = ${pkgId}
    `;
    const postStatus = postUpdateRows[0]?.status;
    log(`Package version status after post-Phase 1 retirement: ${postStatus}`);
    if (postStatus !== "RETIRED") {
      throw new Error(
        `Expected package status to be RETIRED, found ${postStatus}`
      );
    }
    log("ACTIVE -> RETIRED successfully verified post-Phase 1.");

    // 9. Verify prohibited commercial mutation STILL FAILS
    log("Verifying prohibited commercial mutation (price change) still fails...");
    let commercialMutationFailed = false;
    try {
      await testPrisma.$executeRawUnsafe(
        `UPDATE "ManagedMarketingPackageVersion" SET "priceAmount" = 9999.00 WHERE "id" = $1`,
        pkgId
      );
    } catch (err) {
      commercialMutationFailed = true;
      log(`Commercial mutation was rejected as expected: ${err.message || err}`);
    }

    if (!commercialMutationFailed) {
      throw new Error(
        "Commercial mutation invariant violation: priceAmount modification was unexpectedly permitted on RETIRED package!"
      );
    }
    log("Commercial mutation protection successfully verified post-Phase 1.");

    log("=== HISTORICAL DATABASE UPGRADE PROOF PASSED ===");
  } finally {
    if (testPrisma) {
      await testPrisma.$disconnect().catch(() => {});
    }
    log(`Dropping disposable database: ${disposableDbName}`);
    try {
      await rootPrisma.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS "${disposableDbName}" WITH (FORCE)`
      );
      log("Disposable database dropped cleanly.");
    } catch (cleanupErr) {
      console.warn("Could not drop disposable database:", cleanupErr);
    }
    await rootPrisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[FATAL_MIGRATION_UPGRADE_PROOF_ERROR]", err);
  process.exit(1);
});
