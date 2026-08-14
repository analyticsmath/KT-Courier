import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getSchemaVerifierComposeArgs,
  isSchemaDiffVerbose,
} from "../../scripts/docker-common.mjs";
import {
  DRIFT_SUMMARY_LIMIT,
  conciseDriftSummary,
  formatVerboseDriftReport,
  parseDriftLine,
  parsePrismaDrift,
  sanitizeSchemaDiff,
} from "../../scripts/verify-database-schema.mjs";

const root = process.cwd();
const verifier = readFileSync(path.join(root, "scripts", "verify-database-schema.mjs"), "utf8");
const dockerMigrationSmoke = readFileSync(path.join(root, "scripts", "docker-migration-smoke.mjs"), "utf8");
const dockerSmoke = readFileSync(path.join(root, "scripts", "docker-smoke.mjs"), "utf8");
const dockerPhaseBRuntimeClosure = readFileSync(path.join(root, "scripts", "docker-phase-b-runtime-closure.mjs"), "utf8");
const dockerGate4Integration = readFileSync(path.join(root, "scripts", "docker-gate4-integration.mjs"), "utf8");
const duplicatedSchemaVerifierArgs = '["run", "--rm", "migrate", "node", "scripts/verify-database-schema.mjs"]';

describe("database schema verification script", () => {
  it("compares a database URL with the current datamodel using Prisma diff exit codes", () => {
    expect(verifier).toContain("migrate");
    expect(verifier).toContain("diff");
    expect(verifier).toContain("--from-url");
    expect(verifier).toContain("--to-schema-datamodel");
    expect(verifier).toContain("--exit-code");
  });

  it("uses shared sanitization rather than writing connection details", () => {
    expect(verifier).toContain("safeError");
    expect(verifier).toContain("safeLog");
    expect(verifier).toContain("sanitize");
    expect(verifier).toContain("KT_SCHEMA_DRIFT_ARTIFACT");
    expect(verifier).toContain("Prisma diff executed successfully");
    expect(verifier).toContain("KT_SCHEMA_DIFF_VERBOSE");
    expect(verifier).toContain("Complete structured drift report:");
    expect(verifier).toContain("Complete sanitized Prisma output:");
    expect(verifier).not.toMatch(/console\.(?:log|error)/);
  });

  it("keeps table context across multiline Prisma diff sections", () => {
    const fixture = [
      "[*] Changed the `CatalogDuplicateCandidate` table",
      "  [+] Added index on columns (candidateProductId)",
      "[*] Changed the `CatalogImportJob` table",
      "  [+] Added index on columns (storeId, status, createdAt)",
      "[*] Changed the `CatalogImportRow` table",
      "  [+] Added index on columns (jobId, status)",
      "  [+] Added index on columns (resultingProductId)",
      "  [+] Added index on columns (resultingOfferId)",
      "  [+] Added foreign key on columns (jobId)",
      "  [+] Added column `normalizationVersion`",
      "  [+] Added unique index on columns (jobId, rowNumber)",
      "[*] Changed the `CatalogInventoryItem` table",
      "  [+] Added index on columns (variantId)",
      "  [+] Added index on columns (trackingMode)",
      "[*] Changed the `CatalogInventoryLevel` table",
      "  [+] Added index on columns (locationId)",
      "  [-] Removed foreign key on columns (locationId)",
      "[*] Changed the `CatalogImportRowStatus` enum",
    ];
    let table: string | null = null;
    const formatted: string[] = [];

    for (const line of fixture) {
      const result = parseDriftLine(line, table);
      if (result.newTable) table = result.newTable;
      else if (result.clearTable) table = null;
      if (result.formatted) formatted.push(result.formatted);
    }

    expect(formatted).toEqual([
      "[INDEX_MISSING] CatalogDuplicateCandidate(candidateProductId)",
      "[INDEX_MISSING] CatalogImportJob(storeId, status, createdAt)",
      "[INDEX_MISSING] CatalogImportRow(jobId, status)",
      "[INDEX_MISSING] CatalogImportRow(resultingProductId)",
      "[INDEX_MISSING] CatalogImportRow(resultingOfferId)",
      "[FOREIGN_KEY_MISSING] CatalogImportRow.jobId",
      "[COLUMN_MISSING] CatalogImportRow.normalizationVersion",
      "[UNIQUE_INDEX_MISSING] CatalogImportRow(jobId, rowNumber)",
      "[INDEX_MISSING] CatalogInventoryItem(variantId)",
      "[INDEX_MISSING] CatalogInventoryItem(trackingMode)",
      "[INDEX_MISSING] CatalogInventoryLevel(locationId)",
      "[FOREIGN_KEY_EXTRA] CatalogInventoryLevel.locationId",
    ]);
    expect(formatted.join(" ")).not.toContain("UnknownTable");
    expect(conciseDriftSummary(fixture.join("\n"))).not.toContain("UnknownTable");
  });

  it("keeps normal output concise while exposing every sanitized structural difference in verbose mode", () => {
    const fixture = [
      "[*] Changed the `CatalogProduct` table",
      "  [+] Added index on columns (available)",
      "  [-] Removed index on columns (legacyCode)",
      "  [+] Added unique index on columns (scope, sourceStoreId, slug) where deletedAt IS NULL",
      "  [-] Removed unique index on columns (legacyScope, legacySlug)",
      '  [+] Added foreign key on columns (storeId) referencing "CatalogStore" (id) on delete Cascade on update Restrict',
      "  [-] Removed foreign key on columns (actorUserId) to table User on columns (id) on delete Set Null on update Cascade",
      "  [+] Added column `normalizationVersion`",
      "  [-] Removed column `legacyStatus`",
      "  [*] Changed column `status`",
      "  [+] Added check constraint `status_valid`",
      "[*] Changed the `CatalogInventoryLevel` table",
      "  [+] Added index on columns (locationId, available)",
      "[+] Added the `CatalogNewTable` table",
      "[-] Removed table `CatalogLegacyTable`",
      "[+] Added enum `CatalogNewStatus`",
      "[-] Removed `CatalogLegacyStatus` enum",
      "  [+] Added check constraint `sanitized` postgresql://embedded_user:super-secret@database.example:5432/catalog PROVIDER_API_KEY=provider-secret",
    ].join("\n");

    const report = parsePrismaDrift(fixture);
    const summary = conciseDriftSummary(fixture);
    const verbose = formatVerboseDriftReport(fixture);

    expect(report.structuralLineCount).toBe(16);
    expect(report.differences).toHaveLength(16);
    expect(report.differences.map((difference) => difference.type)).toEqual([
      "INDEX_MISSING",
      "INDEX_EXTRA",
      "UNIQUE_INDEX_MISSING",
      "UNIQUE_INDEX_EXTRA",
      "FOREIGN_KEY_MISSING",
      "FOREIGN_KEY_EXTRA",
      "COLUMN_MISSING",
      "COLUMN_EXTRA",
      "COLUMN_CHANGED",
      "UNCLASSIFIED_DRIFT",
      "INDEX_MISSING",
      "TABLE_MISSING",
      "TABLE_EXTRA",
      "ENUM_MISSING",
      "ENUM_EXTRA",
      "UNCLASSIFIED_DRIFT",
    ]);
    expect(summary).toContain(`Showing ${DRIFT_SUMMARY_LIMIT} of 16 differences. Set KT_SCHEMA_DIFF_VERBOSE=1 for the complete report.`);
    expect(summary).not.toContain("[UNCLASSIFIED_DRIFT] CatalogProduct: [+] Added check constraint `status_valid`");
    expect(verbose.summary).toContain("Total parsed differences: 16");
    expect(verbose.summary).toContain("[COLUMN_EXTRA] table=CatalogProduct columns=(legacyStatus)");
    expect(verbose.summary).toContain("[TABLE_MISSING] table=CatalogNewTable");
    expect(verbose.summary).toContain("[TABLE_EXTRA] table=CatalogLegacyTable");
    expect(verbose.summary).toContain("[ENUM_MISSING] table=CatalogNewStatus");
    expect(verbose.summary).toContain("[ENUM_EXTRA] table=CatalogLegacyStatus");
    expect(verbose.summary).toContain("[UNCLASSIFIED_DRIFT] CatalogProduct: [+] Added check constraint `status_valid`");

    expect(report.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "CatalogProduct",
          type: "UNIQUE_INDEX_MISSING",
          columns: ["scope", "sourceStoreId", "slug"],
          unique: true,
          predicate: "deletedAt IS NULL",
        }),
        expect.objectContaining({
          table: "CatalogProduct",
          type: "FOREIGN_KEY_MISSING",
          columns: ["storeId"],
          targetTable: "CatalogStore",
          targetColumns: ["id"],
          onDelete: "Cascade",
          onUpdate: "Restrict",
        }),
        expect.objectContaining({
          table: "CatalogProduct",
          type: "FOREIGN_KEY_EXTRA",
          columns: ["actorUserId"],
          targetTable: "User",
          targetColumns: ["id"],
          onDelete: "Set Null",
          onUpdate: "Cascade",
        }),
        expect.objectContaining({
          table: "CatalogProduct",
          type: "COLUMN_CHANGED",
          columns: ["status"],
        }),
        expect.objectContaining({
          table: "CatalogProduct",
          type: "UNCLASSIFIED_DRIFT",
          source: "[+] Added check constraint `status_valid`",
        }),
        expect.objectContaining({
          table: "UnknownTable",
          type: "UNCLASSIFIED_DRIFT",
          source: expect.stringMatching(/\[redacted (?:credential|connection) URL\]/),
        }),
      ])
    );
    expect(verbose.sanitizedOutput).not.toContain("embedded_user");
    expect(verbose.sanitizedOutput).not.toContain("super-secret");
    expect(verbose.sanitizedOutput).not.toContain("provider-secret");
  });

  it("preserves zero-drift behavior when Prisma reports no structural changes", () => {
    const report = parsePrismaDrift("No difference detected.");

    expect(report.structuralLineCount).toBe(0);
    expect(report.differences).toEqual([]);
    expect(verifier).toContain("database schema matches prisma/schema.prisma");
  });

  it("sanitizes connection URLs, usernames, provider credentials, and secret query values", () => {
    const sanitized = sanitizeSchemaDiff(
      "postgresql://database_user:database-secret@db.example.test:5432/catalog " +
        "https://provider_user:provider-secret@api.example.test/schema?token=provider-token " +
        "PROVIDER_API_KEY=api-secret Authorization: Bearer bearer-secret"
    );

    for (const secret of [
      "database_user",
      "database-secret",
      "provider_user",
      "provider-secret",
      "provider-token",
      "api-secret",
      "bearer-secret",
    ]) {
      expect(sanitized).not.toContain(secret);
    }
    expect(sanitized).toContain("PROVIDER_API_KEY=[redacted]");
    expect(sanitized).toContain("Authorization: Bearer [redacted]");
  });

  describe("Docker Compose schema drift argument construction", () => {
    it("adds -e KT_SCHEMA_DIFF_VERBOSE=1 when host value is 1", () => {
      const env: Record<string, string | undefined> = { KT_SCHEMA_DIFF_VERBOSE: "1" };
      expect(isSchemaDiffVerbose(env)).toBe(true);
      expect(getSchemaVerifierComposeArgs(env)).toEqual([
        "run",
        "--rm",
        "-e",
        "KT_SCHEMA_DIFF_VERBOSE=1",
        "migrate",
        "node",
        "scripts/verify-database-schema.mjs",
      ]);
    });

    it("adds normalized -e KT_SCHEMA_DIFF_VERBOSE=1 when host value is true", () => {
      for (const val of ["true", "TRUE", " True "]) {
        const env: Record<string, string | undefined> = { KT_SCHEMA_DIFF_VERBOSE: val };
        expect(isSchemaDiffVerbose(env)).toBe(true);
        expect(getSchemaVerifierComposeArgs(env)).toEqual([
          "run",
          "--rm",
          "-e",
          "KT_SCHEMA_DIFF_VERBOSE=1",
          "migrate",
          "node",
          "scripts/verify-database-schema.mjs",
        ]);
      }
    });

    it("adds normalized -e KT_SCHEMA_DIFF_VERBOSE=1 when host value is yes", () => {
      for (const val of ["yes", "YES", " Yes "]) {
        const env: Record<string, string | undefined> = { KT_SCHEMA_DIFF_VERBOSE: val };
        expect(isSchemaDiffVerbose(env)).toBe(true);
        expect(getSchemaVerifierComposeArgs(env)).toEqual([
          "run",
          "--rm",
          "-e",
          "KT_SCHEMA_DIFF_VERBOSE=1",
          "migrate",
          "node",
          "scripts/verify-database-schema.mjs",
        ]);
      }
    });

    it("adds normalized -e KT_SCHEMA_DIFF_VERBOSE=1 when host value is on", () => {
      for (const val of ["on", "ON", " On "]) {
        const env: Record<string, string | undefined> = { KT_SCHEMA_DIFF_VERBOSE: val };
        expect(isSchemaDiffVerbose(env)).toBe(true);
        expect(getSchemaVerifierComposeArgs(env)).toEqual([
          "run",
          "--rm",
          "-e",
          "KT_SCHEMA_DIFF_VERBOSE=1",
          "migrate",
          "node",
          "scripts/verify-database-schema.mjs",
        ]);
      }
    });

    it("does not inject the variable when unset or empty", () => {
      const nonVerboseEnvs: Array<Record<string, string | undefined>> = [
        {},
        { KT_SCHEMA_DIFF_VERBOSE: "" },
        { KT_SCHEMA_DIFF_VERBOSE: "   " },
      ];
      for (const env of nonVerboseEnvs) {
        expect(isSchemaDiffVerbose(env)).toBe(false);
        expect(getSchemaVerifierComposeArgs(env)).toEqual([
          "run",
          "--rm",
          "migrate",
          "node",
          "scripts/verify-database-schema.mjs",
        ]);
      }
    });

    it("does not enable verbose mode when host value is 0", () => {
      const env: Record<string, string | undefined> = { KT_SCHEMA_DIFF_VERBOSE: "0" };
      expect(isSchemaDiffVerbose(env)).toBe(false);
      expect(getSchemaVerifierComposeArgs(env)).toEqual([
        "run",
        "--rm",
        "migrate",
        "node",
        "scripts/verify-database-schema.mjs",
      ]);
    });

    it("does not enable verbose mode for arbitrary values (e.g. false, no, off, 2, verbose, debug)", () => {
      for (const val of ["false", "no", "off", "2", "verbose", "debug", "10", "trueish"]) {
        const env: Record<string, string | undefined> = { KT_SCHEMA_DIFF_VERBOSE: val };
        expect(isSchemaDiffVerbose(env)).toBe(false);
        expect(getSchemaVerifierComposeArgs(env)).toEqual([
          "run",
          "--rm",
          "migrate",
          "node",
          "scripts/verify-database-schema.mjs",
        ]);
      }
    });

    it("preserves normal smoke behavior unchanged when verbose is not enabled", () => {
      const args = getSchemaVerifierComposeArgs({});
      expect(args).toEqual([
        "run",
        "--rm",
        "migrate",
        "node",
        "scripts/verify-database-schema.mjs",
      ]);
    });

    it("does not convert secret environment values or arbitrary host variables into Docker -e arguments", () => {
      const env: Record<string, string | undefined> = {
        DATABASE_URL: "postgresql://postgres:secretpassword@localhost:5432/db",
        POSTGRES_PASSWORD: "secretpassword",
        RESEND_API_KEY: "re_secret_key_12345",
        GOOGLE_MAPS_SERVER_KEY: "AIzaSySecretKey",
        SOME_ARBITRARY_HOST_VAR: "arbitrary_value",
      };
      const args = getSchemaVerifierComposeArgs(env);
      expect(args).toEqual([
        "run",
        "--rm",
        "migrate",
        "node",
        "scripts/verify-database-schema.mjs",
      ]);
      expect(args).not.toContain("-e");
      for (const arg of args) {
        expect(arg).not.toContain("secretpassword");
        expect(arg).not.toContain("re_secret_key_12345");
        expect(arg).not.toContain("AIzaSySecretKey");
        expect(arg).not.toContain("SOME_ARBITRARY_HOST_VAR");
      }
    });

    it("ensures every Docker schema-verifier harness uses the shared helper", () => {
      expect(dockerMigrationSmoke).toContain("getSchemaVerifierComposeArgs");
      expect(dockerMigrationSmoke).toContain("isSchemaDiffVerbose");
      expect(dockerMigrationSmoke).toContain('safeLog("Schema drift verbose reporting: ENABLED")');

      expect(dockerSmoke).toContain("getSchemaVerifierComposeArgs");
      expect(dockerSmoke).toContain("isSchemaDiffVerbose");
      expect(dockerSmoke).toContain('safeLog("Schema drift verbose reporting: ENABLED")');

      expect(dockerPhaseBRuntimeClosure).toContain("getSchemaVerifierComposeArgs");
      expect(dockerPhaseBRuntimeClosure).toContain("compose(getSchemaVerifierComposeArgs(env), env)");
      expect(dockerPhaseBRuntimeClosure).not.toContain(duplicatedSchemaVerifierArgs);

      expect(dockerGate4Integration).toContain("getSchemaVerifierComposeArgs");
      expect(dockerGate4Integration).toContain("getSchemaVerifierComposeArgs(gate4Env)");
      expect(dockerGate4Integration).not.toContain(duplicatedSchemaVerifierArgs);
    });
  });
});
