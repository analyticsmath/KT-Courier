import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationsDir = path.join(root, "prisma", "migrations");
const archiveDir = path.join(root, "prisma", "migrations-legacy-prebaseline");

function migrationDirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+_.+/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

describe("Prisma migration chain guardrails", () => {
  it("keeps the initial baseline first and permits additive migrations", () => {
    const active = migrationDirectories(migrationsDir);

    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(active[0]).toMatch(/^\d+_initial_baseline$/);
    expect(existsSync(path.join(migrationsDir, "migration_lock.toml"))).toBe(true);
  });

  it("creates core tables without assuming existing application tables", () => {
    const [baseline] = migrationDirectories(migrationsDir);
    const sql = readFileSync(path.join(migrationsDir, baseline, "migration.sql"), "utf8");
    const firstCreateTable = sql.search(/CREATE\s+TABLE/i);
    const firstAssumption = sql.search(/ALTER\s+TABLE|CREATE\s+INDEX/i);

    expect(firstCreateTable).toBeGreaterThanOrEqual(0);
    expect(firstAssumption === -1 || firstAssumption > firstCreateTable).toBe(true);
    for (const table of ["User", "Session", "Address", "Store", "Order"]) {
      expect(sql).toMatch(new RegExp(`CREATE\\s+TABLE\\s+"${table}"`, "i"));
    }
  });

  it("keeps archived migrations outside Prisma's active deployment path", () => {
    const active = migrationDirectories(migrationsDir);
    const manifest = JSON.parse(readFileSync(path.join(archiveDir, "manifest.json"), "utf8"));
    const archived = manifest.migrations.map((migration: { folder: string }) => migration.folder);

    expect(archived.length).toBeGreaterThan(0);
    expect(active.some((migration) => archived.includes(migration))).toBe(false);
  });

  it("validates the current Prisma schema", () => {
    const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
    const result = spawnSync(process.execPath, [prismaCli, "validate"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
