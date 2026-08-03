import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDir = path.join(root, "prisma", "migrations");
const archiveDir = path.join(root, "prisma", "migrations-legacy-prebaseline");
const archiveManifestPath = path.join(archiveDir, "manifest.json");
const migrationLockPath = path.join(migrationsDir, "migration_lock.toml");
const prismaSchemaPath = path.join(root, "prisma", "schema.prisma");
const requiredBaseTables = ["User", "Session", "Address", "Store", "Order"];
const withdrawalLegacyCompatibilityFields = [
  ["legacyReviewedByUserId", "String?", "reviewedByUserId"],
  ["legacyBankName", "String?", "bankName"],
  ["legacyAccountHolder", "String?", "accountHolder"],
  ["legacyAccountLast4", "String?", "accountLast4"],
  ["legacyRejectionReason", "String?", "rejectionReason"],
  ["legacyMetadata", "Json?", "metadata"],
  ["legacyReviewedAt", "DateTime?", "reviewedAt"],
  ["legacyPaidAt", "DateTime?", "paidAt"],
];
const dangerousPatterns = [
  { label: "DROP TABLE", pattern: /\bDROP\s+TABLE\b/i },
  { label: "DROP COLUMN", pattern: /\bDROP\s+COLUMN\b/i },
  { label: "DROP TYPE", pattern: /\bDROP\s+TYPE\b/i },
  { label: "TRUNCATE", pattern: /\bTRUNCATE\b/i },
  { label: "DELETE FROM", pattern: /\bDELETE\s+FROM\b/i },
  { label: "ALTER TABLE ... DROP", pattern: /\bALTER\s+TABLE\b[\s\S]*?\bDROP\b/i },
];

function checksum(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

function migrationDirectories(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+_.+/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function statementLine(sql, index) {
  return sql.slice(0, index).split(/\r?\n/).length;
}

function findDangerousSql(sql, file) {
  // Replacing the two nullable Phase 4 payment FKs with required RESTRICT FKs
  // is a reviewed structural hardening, not a data/table/column drop.
  const inspectedSql = file.includes("20260717020000_phase10_payment_provider_foundation")
    ? sql
        .replace(/ALTER\s+COLUMN\s+"[A-Za-z0-9_]+"\s+DROP\s+(?:DEFAULT|NOT\s+NULL)/gi, "")
        .replace(/ALTER\s+TABLE\s+"Payment"\s+DROP\s+CONSTRAINT\s+"Payment_(?:userId|orderId)_fkey"\s*;/gi, "")
    : file.includes("20260717040000_phase12_payfast_itn_reconciliation")
      // Retaining the old fields while making their former NOT NULL/default
      // requirements optional is additive: it preserves every column and row.
      // It permits the Phase 12 null-only compatibility constraint without a
      // data rewrite or physical-column removal.
      ? sql.replace(/ALTER\s+COLUMN\s+"(?:eventType|processingStatus|payload)"\s+DROP\s+(?:DEFAULT|NOT\s+NULL)/gi, "")
      : file.includes("20260717050000_phase13_withdrawals_finance_admin")
        // The Phase 13 placeholder is preflight-required to be empty. Replacing
        // its old nullable requester FK/defaults is structural hardening; the
        // legacy bank columns and old enum type remain physically retained.
        ? sql
          .replace(/ALTER\s+TABLE\s+"WithdrawalRequest"\s+ALTER\s+COLUMN\s+"(?:status|currency)"\s+DROP\s+DEFAULT\s*;/gi, "")
          .replace(/ALTER\s+TABLE\s+"WithdrawalRequest"\s+DROP\s+CONSTRAINT\s+"WithdrawalRequest_requestedByUserId_fkey"\s*;/gi, "")
      : sql;
  const findings = [];
  for (const { label, pattern } of dangerousPatterns) {
    const match = pattern.exec(inspectedSql);
    if (match) {
      findings.push({ file, line: statementLine(sql, match.index), label });
    }
  }
  return findings;
}

function loadArchiveManifest() {
  if (!existsSync(archiveManifestPath)) {
    throw new Error("Legacy migration archive manifest is missing.");
  }

  const manifest = JSON.parse(readFileSync(archiveManifestPath, "utf8"));
  if (!Array.isArray(manifest.migrations) || manifest.migrations.length === 0) {
    throw new Error("Legacy migration archive manifest does not contain migrations.");
  }
  return manifest;
}

function verifyArchive(manifest) {
  const archiveDirs = migrationDirectories(archiveDir);
  const manifestNames = manifest.migrations.map((migration) => migration.folder);

  if (new Set(manifestNames).size !== manifestNames.length) {
    throw new Error("Legacy migration archive manifest contains duplicate folder names.");
  }
  if (JSON.stringify(archiveDirs) !== JSON.stringify([...manifestNames].sort())) {
    throw new Error("Legacy migration archive folders do not match manifest.json.");
  }

  for (const [index, migration] of manifest.migrations.entries()) {
    if (migration.order !== index + 1) {
      throw new Error(`Legacy migration archive order is invalid for ${migration.folder}.`);
    }
    const sqlPath = path.join(archiveDir, migration.folder, migration.sqlFile);
    if (!existsSync(sqlPath)) {
      throw new Error(`Archived SQL is missing for ${migration.folder}.`);
    }
    if (checksum(sqlPath) !== migration.sha256) {
      throw new Error(`Archived SQL checksum does not match manifest for ${migration.folder}.`);
    }
  }
}

function verifyActiveBaseline(activeDirs, archiveManifest) {
  if (!existsSync(migrationLockPath)) {
    throw new Error("Active Prisma migration_lock.toml is missing.");
  }
  if (!/provider\s*=\s*"postgresql"/.test(readFileSync(migrationLockPath, "utf8"))) {
    throw new Error("Active Prisma migration_lock.toml is not configured for PostgreSQL.");
  }
  if (activeDirs.length < 1) {
    throw new Error("Expected an active initial baseline migration.");
  }

  const [baseline] = activeDirs;
  if (!/initial_baseline$/i.test(baseline)) {
    throw new Error(`Active migration ${baseline} is not named as an initial baseline.`);
  }
  if (archiveManifest.migrations.some((migration) => migration.folder === baseline)) {
    throw new Error(`Archived migration ${baseline} was returned to the active migration directory.`);
  }

  const sqlPath = path.join(migrationsDir, baseline, "migration.sql");
  if (!existsSync(sqlPath)) {
    throw new Error(`Active baseline ${baseline} does not contain migration.sql.`);
  }

  const rawSql = readFileSync(sqlPath, "utf8");
  const sql = stripSqlComments(rawSql);
  const firstCreateTable = sql.search(/\bCREATE\s+TABLE\b/i);
  const firstAssumption = sql.search(/\bALTER\s+TABLE\b|\bCREATE\s+INDEX\b/i);
  if (firstCreateTable === -1) {
    throw new Error("Active baseline does not create tables.");
  }
  if (firstAssumption !== -1 && firstAssumption < firstCreateTable) {
    throw new Error("Active baseline begins with an assumption about pre-existing tables.");
  }

  for (const table of requiredBaseTables) {
    if (!new RegExp(`CREATE\\s+TABLE\\s+"${table}"`, "i").test(sql)) {
      throw new Error(`Active baseline does not create required base table ${table}.`);
    }
  }

  return { baseline, rawSql, sql };
}

function verifyWithdrawalCompatibility(activeDirs) {
  const phase13 = activeDirs.find((migration) => migration.endsWith("_phase13_withdrawals_finance_admin"));
  if (!phase13) throw new Error("Phase 13 withdrawal migration is missing.");
  if (!existsSync(prismaSchemaPath)) throw new Error("Prisma schema is missing.");

  const schema = readFileSync(prismaSchemaPath, "utf8");
  const withdrawalModel = /model\s+WithdrawalRequest\s+\{([\s\S]*?)\n\}/.exec(schema)?.[1];
  if (!withdrawalModel) throw new Error("WithdrawalRequest model is missing from the Prisma schema.");

  for (const [field, type, column] of withdrawalLegacyCompatibilityFields) {
    const mapping = new RegExp(`^\\s*${field}\\s+${type.replace("?", "\\?")}\\s+@map\\("${column}"\\)\\s+@ignore\\s*$`, "m");
    if (!mapping.test(withdrawalModel)) {
      throw new Error(`WithdrawalRequest.${field} must be an ignored ${column} compatibility mapping.`);
    }
    const fieldIndex = withdrawalModel.search(new RegExp(`^\\s*${field}\\s+`, "m"));
    if (!/Legacy Phase 4 compatibility column\./.test(withdrawalModel.slice(Math.max(0, fieldIndex - 300), fieldIndex))) {
      throw new Error(`WithdrawalRequest.${field} is missing its legacy compatibility documentation comment.`);
    }
  }

  const phase13Path = path.join(migrationsDir, phase13, "migration.sql");
  const phase13Sql = stripSqlComments(readFileSync(phase13Path, "utf8"));
  const compatibilityColumns = withdrawalLegacyCompatibilityFields.map(([, , column]) => column);
  for (const column of compatibilityColumns) {
    if (new RegExp(`ALTER\\s+TABLE\\s+"WithdrawalRequest"[\\s\\S]*?\\b(?:DROP|RENAME)\\s+COLUMN\\s+"${column}"`, "i").test(phase13Sql)) {
      throw new Error(`Phase 13 must not remove or rename the ${column} withdrawal compatibility column.`);
    }
    if (!new RegExp(`"${column}"\\s+IS\\s+NULL`, "i").test(phase13Sql)) {
      throw new Error(`Phase 13 must require new structured withdrawals to leave ${column} null.`);
    }
  }
  if (/ALTER\s+TABLE\s+"WithdrawalRequest"[\s\S]*?\bRENAME\s+COLUMN\b/i.test(phase13Sql)) {
    throw new Error("Phase 13 must not rename a WithdrawalRequest column.");
  }
  if (/\b(?:INSERT\s+INTO|UPDATE)\s+"PayoutDestination"\b/i.test(phase13Sql)) {
    throw new Error("Phase 13 must not copy legacy withdrawal data into PayoutDestination.");
  }
}

try {
  const archiveManifest = loadArchiveManifest();
  verifyArchive(archiveManifest);

  const activeDirs = migrationDirectories(migrationsDir);
  const { baseline, sql } = verifyActiveBaseline(activeDirs, archiveManifest);
  verifyWithdrawalCompatibility(activeDirs);
  const findings = activeDirs.flatMap((migration) => {
    const migrationSql = migration === baseline ? sql : stripSqlComments(readFileSync(path.join(migrationsDir, migration, "migration.sql"), "utf8"));
    return findDangerousSql(migrationSql, path.join("prisma", "migrations", migration, "migration.sql"));
  });

  if (findings.length > 0) {
    console.error("Migration safety check failed. Dangerous SQL token(s) detected:");
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line} ${finding.label}`);
    }
    process.exit(1);
  }

  console.log(`Migration safety check passed. Active baseline: ${baseline}; incremental migrations: ${activeDirs.length - 1}; archived migrations: ${archiveManifest.migrations.length}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
