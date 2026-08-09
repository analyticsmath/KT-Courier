import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260805060000_residual_index_alignment",
  "migration.sql"
);

const residualIndexes = [
  ["CatalogDuplicateCandidate", "CatalogDuplicateCandidate_candidateProductId_idx", ["candidateProductId"]],
  ["CatalogImportJob", "CatalogImportJob_storeId_status_createdAt_idx", ["storeId", "status", "createdAt"]],
  ["CatalogImportRow", "CatalogImportRow_jobId_status_idx", ["jobId", "status"]],
  ["CatalogImportRow", "CatalogImportRow_resultingProductId_idx", ["resultingProductId"]],
  ["CatalogImportRow", "CatalogImportRow_resultingOfferId_idx", ["resultingOfferId"]],
  ["CatalogInventoryItem", "CatalogInventoryItem_variantId_idx", ["variantId"]],
  ["CatalogInventoryItem", "CatalogInventoryItem_trackingMode_idx", ["trackingMode"]],
  ["CatalogInventoryLevel", "CatalogInventoryLevel_locationId_idx", ["locationId"]],
] as const;

const normalizedCatalogVectors = [
  { vector: "indkey::smallint[]", expected: "expected_attnums", count: 5 },
  { vector: "indclass::oid[]", expected: "expected_opclasses", count: 4 },
  { vector: "indcollation::oid[]", expected: "expected_collations", count: 4 },
  { vector: "indoption::smallint[]", expected: "expected_options", count: 4 },
] as const;

function normalizedComparisonPattern(vector: string, expected: string): RegExp {
  const escapedVector = vector.replace(/[\[\]]/g, "\\$&");

  return new RegExp(
    `ARRAY\\(\\s*SELECT vector_value\\s*FROM unnest\\(index_definition\\.${escapedVector}\\)\\s*WITH ORDINALITY AS normalized\\(vector_value, position\\)\\s*ORDER BY position\\s*\\) = ${expected}`,
    "g"
  );
}

function validationPath(sql: string, start: string, end: string): string {
  const startIndex = sql.indexOf(start);
  const endIndex = sql.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return sql.slice(startIndex, endIndex);
}

describe("20260805060000_residual_index_alignment", () => {
  it("contains all eight authoritative Prisma index specifications", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const [table, index, columns] of residualIndexes) {
      expect(sql).toContain(`('${table}', '${index}', ARRAY[${columns.map((column) => `'${column}'`).join(", ")}]::text[])`);
    }
  });

  it("normalizes PostgreSQL catalog vectors before every equality comparison", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).not.toMatch(
      /index_definition\.(?:indkey::smallint\[\]|indclass::oid\[\]|indcollation::oid\[\]|indoption::smallint\[\])\s*=\s*expected_(?:attnums|opclasses|collations|options)/
    );

    for (const { vector, expected, count } of normalizedCatalogVectors) {
      const matches = sql.match(normalizedComparisonPattern(vector, expected));
      expect(matches).toHaveLength(count);
      expect(matches?.every((match) => match.includes("WITH ORDINALITY") && match.includes("ORDER BY position"))).toBe(true);
    }
  });

  it("uses normalized comparisons across all five validation paths", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const paths = [
      validationPath(sql, "IF named_index_oid IS NOT NULL AND NOT EXISTS (", "IF named_index_oid IS NOT NULL THEN"),
      validationPath(sql, "-- A partial index", "-- A unique index"),
      validationPath(sql, "-- A unique index", "-- A full equivalent"),
      validationPath(sql, "-- A full equivalent", "IF equivalent_index_name IS NOT NULL THEN"),
      validationPath(sql, "EXECUTE format(", "END IF;\n  END LOOP;"),
    ];

    for (const pathSql of paths) {
      expect(pathSql).toMatch(normalizedComparisonPattern("indkey::smallint[]", "expected_attnums"));
    }

    for (const pathSql of [paths[0], paths[2], paths[3], paths[4]]) {
      for (const { vector, expected } of normalizedCatalogVectors.slice(1)) {
        expect(pathSql).toMatch(normalizedComparisonPattern(vector, expected));
      }
    }
  });

  it("is additive and fails closed on unsafe index substitutions", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("pg_index AS index_definition");
    expect(sql).toContain("index_definition.indpred IS NOT NULL");
    expect(sql).toContain("index_definition.indisunique");
    expect(sql).toContain("'anyenum'::regtype");
    expect(sql).toContain("'CREATE INDEX IF NOT EXISTS %I ON %s (%s)'");
    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|TYPE|CONSTRAINT|INDEX)\b/i);
    expect(sql).not.toMatch(/CREATE\s+INDEX\s+CONCURRENTLY/i);
  });
});
