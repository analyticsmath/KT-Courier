import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseDriftLine } from "../../scripts/verify-database-schema.mjs";

const root = process.cwd();
const alignmentMigrationPath = path.join(
  root,
  "prisma",
  "migrations",
  "20260805050000_final_schema_alignment",
  "migration.sql"
);
const checkerPath = path.join(root, "scripts", "check-migrations-safety.mjs");

describe("20260805050000_final_schema_alignment migration safety, integrity and drift reporting", () => {
  it("contains preflight integrity checks and statements for all 8 drift items", () => {
    const sql = readFileSync(alignmentMigrationPath, "utf8");

    // Foreign key removals (CatalogCategory createdByUserId and updatedByUserId)
    expect(sql).toContain('ALTER TABLE "CatalogCategory" DROP CONSTRAINT IF EXISTS "CatalogCategory_createdByUserId_fkey";');
    expect(sql).toContain('ALTER TABLE "CatalogCategory" DROP CONSTRAINT IF EXISTS "CatalogCategory_updatedByUserId_fkey";');

    // Index additions
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "CatalogAuditHistory_aggregateType_aggregateReference_createdAt_idx"');
    expect(sql).toContain('ON "CatalogAuditHistory"("aggregateType", "aggregateReference", "createdAt");');

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "CatalogAuditHistory_actorUserId_createdAt_idx"');
    expect(sql).toContain('ON "CatalogAuditHistory"("actorUserId", "createdAt");');

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "CatalogBrand_status_name_idx"');
    expect(sql).toContain('ON "CatalogBrand"("status", "name");');

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "CatalogCategoryProductType_categoryId_isPrimary_idx"');
    expect(sql).toContain('ON "CatalogCategoryProductType"("categoryId", "isPrimary");');

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "CatalogChangeEvent_processedAt_createdAt_idx"');
    expect(sql).toContain('ON "CatalogChangeEvent"("processedAt", "createdAt");');

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "CatalogChangeEvent_aggregateType_aggregateReference_idx"');
    expect(sql).toContain('ON "CatalogChangeEvent"("aggregateType", "aggregateReference");');
  });

  it("passes the repository migration-safety check with approved final schema alignment constraint drops", () => {
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

  it("formats drift reporter summary lines with table name, object type, columns, and change direction", () => {
    const line1 = parseDriftLine("[+] Added index on columns (aggregateType, aggregateReference, createdAt)", "CatalogAuditHistory");
    expect(line1.formatted).toBe("[INDEX_MISSING] CatalogAuditHistory(aggregateType, aggregateReference, createdAt)");

    const line2 = parseDriftLine("[-] Removed foreign key on columns (createdByUserId)", "CatalogCategory");
    expect(line2.formatted).toBe("[FOREIGN_KEY_EXTRA] CatalogCategory.createdByUserId");

    const line3 = parseDriftLine("[+] Added index on columns (categoryId, isPrimary)", "CatalogCategoryProductType");
    expect(line3.formatted).toBe("[INDEX_MISSING] CatalogCategoryProductType(categoryId, isPrimary)");
  });
});
