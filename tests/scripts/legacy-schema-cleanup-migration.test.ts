import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const cleanupMigrationPath = path.join(
  root,
  "prisma",
  "migrations",
  "20260805040000_legacy_schema_cleanup",
  "migration.sql"
);
const checkerPath = path.join(root, "scripts", "check-migrations-safety.mjs");

describe("20260805040000_legacy_schema_cleanup migration safety and integrity", () => {
  it("contains preflight integrity checks for ApplicationDocument and ApplicationStatusHistory", () => {
    const sql = readFileSync(cleanupMigrationPath, "utf8");

    expect(sql).toContain('RENAME TO "ApplicationDocument"');
    expect(sql).toContain('RENAME TO "ApplicationStatusHistory"');
    expect(sql).toContain("LegacyApplicationDocument contains rows with missing or invalid applicationId references");
    expect(sql).toContain("LegacyApplicationDocument contains rows with invalid reviewedByUserId references");
    expect(sql).toContain("LegacyApplicationStatusHistory contains rows with missing or invalid applicationId references");
    expect(sql).toContain("LegacyApplicationStatusHistory contains rows with invalid changedByUserId references");
  });

  it("contains dependency preflight checks before dropping obsolete enums ExportFormat and WithdrawalStatus_legacy_phase4", () => {
    const sql = readFileSync(cleanupMigrationPath, "utf8");

    expect(sql).toContain("Cannot remove enum ExportFormat because dependencies remain");
    expect(sql).toContain("Cannot remove enum WithdrawalStatus_legacy_phase4 because dependencies remain");
    expect(sql).toContain('DROP TYPE "ExportFormat";');
    expect(sql).toContain('DROP TYPE "WithdrawalStatus_legacy_phase4";');
  });

  it("passes the repository migration-safety check with approved cleanup enums", () => {
    const output = execFileSync(process.execPath, [checkerPath], { cwd: root, encoding: "utf8" });
    expect(output).toContain("Migration safety check passed");
  });

  it("validates the authoritative Prisma schema", () => {
    const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
    const result = spawnSync(process.execPath, [prismaCli, "validate"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
