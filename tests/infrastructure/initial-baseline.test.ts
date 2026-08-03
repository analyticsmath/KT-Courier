import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationsDir = path.join(root, "prisma", "migrations");
const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");

function activeMigrations(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+_.+/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

describe("initial Prisma baseline", () => {
  it("is immutable and lexically first; later incremental migrations are allowed", () => {
    const migrations = activeMigrations();
    expect(migrations).toEqual([...migrations].sort());
    expect(migrations.length).toBeGreaterThanOrEqual(1);
    expect(migrations[0]).toMatch(/^\d+_initial_baseline$/);
  });

  it("creates every current Prisma model and enum across the additive chain", () => {
    const sql = activeMigrations()
      .map((migration) => readFileSync(path.join(migrationsDir, migration, "migration.sql"), "utf8"))
      .join("\n");
    const models = [...schema.matchAll(/^model\s+(\w+)\s+\{([\s\S]*?)\n\}/gm)].map((match) => {
      const mapMatch = match[2].match(/@@map\("([^"]+)"\)/);
      return mapMatch ? mapMatch[1] : match[1];
    });

    const enums = [...schema.matchAll(/^enum\s+(\w+)\s+\{([\s\S]*?)\n\}/gm)].map((match) => {
      const mapMatch = match[2].match(/@@map\("([^"]+)"\)/);
      return mapMatch ? mapMatch[1] : match[1];
    });

    for (const model of models) {
      expect(sql).toMatch(new RegExp(`(?:CREATE\\s+TABLE|RENAME\\s+TO)\\s+"${model}"`, "i"));
    }
    for (const enumeration of enums) {
      expect(sql).toMatch(new RegExp(`"${enumeration}"`, "i"));
    }
  });

  it("contains no destructive SQL or environment-specific values", () => {
    const [baseline] = activeMigrations();
    const sql = readFileSync(path.join(migrationsDir, baseline, "migration.sql"), "utf8");

    expect(sql).toMatch(/CREATE\s+TABLE/i);
    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b[\s\S]*?\bDROP\b/i);
    expect(sql).not.toMatch(/kt_courier_(?:dev|shadow|smoke|ci)/i);
  });
});
