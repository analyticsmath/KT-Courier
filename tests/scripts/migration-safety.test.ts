import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const checkerPath = path.join(process.cwd(), "scripts", "check-migrations-safety.mjs");
const reconciliationMigrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260805030000_schema_drift_reconciliation",
  "migration.sql"
);
const tempDirs: string[] = [];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createMigrationFixture(extraSql = ""): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kt-migration-safety-"));
  tempDirs.push(dir);

  const migrationsDir = path.join(dir, "prisma", "migrations");
  const baselineDir = path.join(migrationsDir, "20260710010000_initial_baseline");
  const archiveDir = path.join(dir, "prisma", "migrations-legacy-prebaseline");
  const legacyDir = path.join(archiveDir, "20260611000000_legacy");
  mkdirSync(baselineDir, { recursive: true });
  mkdirSync(legacyDir, { recursive: true });

  const baselineSql = `
    CREATE TABLE "User" ("id" TEXT NOT NULL);
    CREATE TABLE "Session" ("id" TEXT NOT NULL);
    CREATE TABLE "Address" ("id" TEXT NOT NULL);
    CREATE TABLE "Store" ("id" TEXT NOT NULL);
    CREATE TABLE "Order" ("id" TEXT NOT NULL);
    ${extraSql}
  `;
  const legacySql = 'CREATE TABLE "Legacy" ("id" TEXT NOT NULL);\n';
  writeFileSync(path.join(migrationsDir, "migration_lock.toml"), 'provider = "postgresql"\n', "utf8");
  writeFileSync(path.join(baselineDir, "migration.sql"), baselineSql, "utf8");
  writeFileSync(path.join(legacyDir, "migration.sql"), legacySql, "utf8");
  const phase13Dir = path.join(migrationsDir, "20260717050000_phase13_withdrawals_finance_admin");
  mkdirSync(phase13Dir, { recursive: true });
  const realPhase13Sql = readFileSync(path.join(process.cwd(), "prisma", "migrations", "20260717050000_phase13_withdrawals_finance_admin", "migration.sql"), "utf8");
  writeFileSync(path.join(phase13Dir, "migration.sql"), realPhase13Sql, "utf8");
  const phase29Dir = path.join(migrationsDir, "20260728000000_phase29_reporting_exports");
  mkdirSync(phase29Dir, { recursive: true });
  const realPhase29Sql = readFileSync(path.join(process.cwd(), "prisma", "migrations", "20260728000000_phase29_reporting_exports", "migration.sql"), "utf8");
  writeFileSync(path.join(phase29Dir, "migration.sql"), realPhase29Sql, "utf8");

  const realSchemaPrisma = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  writeFileSync(path.join(dir, "prisma", "schema.prisma"), realSchemaPrisma, "utf8");

  writeFileSync(
    path.join(archiveDir, "manifest.json"),
    `${JSON.stringify({ migrations: [{ order: 1, folder: "20260611000000_legacy", sqlFile: "migration.sql", sha256: sha256(legacySql) }] })}\n`,
    "utf8"
  );

  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("migration safety checker", () => {
  it("passes the approved Phase 29 obsolete-report replacement and additive initial baseline", () => {
    const cwd = createMigrationFixture();
    const output = execFileSync(process.execPath, [checkerPath], { cwd, encoding: "utf8" });

    expect(output).toContain("Migration safety check passed");
  });

  it("fails when a dangerous SQL token is present in the active baseline", () => {
    const cwd = createMigrationFixture('DROP TABLE "User";');
    const result = spawnSync(process.execPath, [checkerPath], { cwd, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DROP TABLE");
  });

  it("continues to reject an unrelated DROP INDEX statement", () => {
    const cwd = createMigrationFixture('DROP INDEX "User_email_idx";');
    const result = spawnSync(process.execPath, [checkerPath], { cwd, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DROP INDEX");
  });

  it("keeps the schema-drift reconciliation forward-only and fail-closed", () => {
    const sql = readFileSync(reconciliationMigrationPath, "utf8");

    expect(sql).toContain('ADD COLUMN "orderId" TEXT');
    expect(sql).toContain('ADD COLUMN "currency" "LedgerCurrency"');
    expect(sql).toContain("Schema drift reconciliation blocked");
    expect(sql).toContain('ALTER COLUMN "currency" SET NOT NULL');
    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
  });
});
