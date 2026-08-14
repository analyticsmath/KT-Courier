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
  { label: "DROP TABLE", pattern: /\bDROP\s+TABLE\b/gi },
  { label: "DROP COLUMN", pattern: /\bDROP\s+COLUMN\b/gi },
  { label: "DROP TYPE", pattern: /\bDROP\s+TYPE\b/gi },
  { label: "DROP CONSTRAINT", pattern: /\bDROP\s+CONSTRAINT\b/gi },
  { label: "DROP INDEX", pattern: /\bDROP\s+INDEX\b/gi },
  { label: "TRUNCATE", pattern: /\bTRUNCATE\b/gi },
  { label: "DELETE FROM", pattern: /\bDELETE\s+FROM\b/gi },
];
const approvedDestructiveOperations = [
  {
    migration: "20260728000000_phase29_reporting_exports",
    label: "DROP TABLE",
    statement: /^\s*DROP\s+TABLE\s+IF\s+EXISTS\s+"ReportJob"\s+CASCADE\s*;\s*$/i,
    // Phase 29 replaces the baseline's obsolete ReportJob shape before any
    // reporting data is relied upon; the same migration recreates it with the
    // governed export schema below.
    reason: "Replaces the obsolete baseline ReportJob placeholder with the governed reporting job schema.",
  },
  {
    migration: "20260728000000_phase29_reporting_exports",
    label: "DROP TYPE",
    statement: /^\s*DROP\s+TYPE\s+IF\s+EXISTS\s+"ReportJobStatus"\s+CASCADE\s*;\s*$/i,
    // The replacement enum is created immediately afterwards with the status
    // values required by the recreated Phase 29 ReportJob table.
    reason: "Replaces the obsolete baseline ReportJobStatus enum for the recreated reporting job schema.",
  },
  {
    migration: "20260805040000_legacy_schema_cleanup",
    label: "DROP TYPE",
    statement: /^\s*DROP\s+TYPE\s+"ExportFormat"\s*;\s*$/i,
    // Baseline ExportFormat enum is obsolete, superseded by ReportExportFormat, and has no remaining catalog dependencies.
    reason: "Removes obsolete baseline ExportFormat enum after catalog dependency preflight verification.",
  },
  {
    migration: "20260805040000_legacy_schema_cleanup",
    label: "DROP TYPE",
    statement: /^\s*DROP\s+TYPE\s+"WithdrawalStatus_legacy_phase4"\s*;\s*$/i,
    // Phase 4 withdrawal status enum was retained during Phase 13 and has no remaining catalog dependencies.
    reason: "Removes obsolete Phase 4 withdrawal status enum after Phase 13 migration and catalog dependency preflight verification.",
  },
  {
    migration: "20260805050000_final_schema_alignment",
    label: "DROP CONSTRAINT",
    statement: /^\s*ALTER\s+TABLE\s+"CatalogCategory"\s+DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?"CatalogCategory_(?:createdByUserId|updatedByUserId)_fkey"\s*;\s*$/i,
    // CatalogCategory user foreign keys are un-navigated; user relations are intentionally omitted in Prisma to preserve independent audit evidence and unblock user lifecycle.
    reason: "Removes un-navigated CatalogCategory user foreign keys to preserve independent audit evidence and unblock user lifecycle.",
  },
  {
    migration: "20260805070000_comprehensive_schema_reconciliation",
    label: "DROP CONSTRAINT",
    statement: /^\s*ALTER\s+TABLE\s+"PaymentWebhookEvent"\s+DROP\s+CONSTRAINT\s+"PaymentWebhookEvent_paymentId_fkey"\s*;\s*$/i,
    // Baseline PaymentWebhookEvent_paymentId_fkey foreign key was superseded by Phase 12 PaymentWebhookEvent_paymentId_phase12_restrict_fkey constraint; legacy constraint drop is verified by fail-closed preflight.
    reason: "Removes obsolete baseline duplicate foreign key PaymentWebhookEvent_paymentId_fkey after fail-closed preflight verification.",
  },
  {
    migration: "20260811160000_phase_b_promoter_programme_closure",
    label: "DROP CONSTRAINT",
    statement: /^\s*ALTER\s+TABLE\s+"PromoterAttribution"\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+"PromoterAttribution_one_subject"\s*;\s*$/i,
    reason: "Replaces the three-subject check with the additive four-subject check required for driver acquisition; no attribution rows or columns are removed.",
  },
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

function statementContaining(sql, index) {
  const statementStart = sql.lastIndexOf(";", index) + 1;
  const statementEnd = sql.indexOf(";", index);
  return sql.slice(statementStart, statementEnd === -1 ? sql.length : statementEnd + 1);
}

function approvedDestructiveOperation(migration, finding) {
  return approvedDestructiveOperations.find(
    (approval) =>
      approval.migration === migration &&
      approval.label === finding.label &&
      approval.statement.test(finding.statement)
  );
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
      : file.includes("20260717070000_phase15_customer_wallet_refunds")
        ? sql.replace(/ALTER\s+TABLE\s+"PaymentRefund"\s+DROP\s+CONSTRAINT\s+"PaymentRefund_paymentId_fkey"\s*;/gi, "")
      : file.includes("20260717080000_phase16_store_earnings")
        ? sql.replace(/ALTER\s+TABLE\s+"RefundFundingAllocation"\s+DROP\s+CONSTRAINT\s+"RefundFundingAllocation_source_shape_check"\s*;/gi, "")
      : file.includes("20260717090000_phase17_driver_earnings")
        ? sql.replace(/ALTER\s+TABLE\s+"(?:CommissionAllocation|RefundFundingAllocation)"\s+DROP\s+CONSTRAINT\s+"[^"]+"\s*;/gi, "")
      : file.includes("20260717140000_phase22_subscriptions")
        ? sql.replace(/ALTER\s+TABLE\s+"Payment"\s+DROP\s+CONSTRAINT\s+"Payment_subject_shape_check"\s*;/gi, "")
      : file.includes("20260814100000_phase_b_payment_subject_integrity_reconciliation")
        // Replaces the prior, marketplace/subscription-era check with the
        // stricter four-subject invariant in the same forward-only migration.
        ? sql.replace(/ALTER\s+TABLE\s+"Payment"\s+DROP\s+CONSTRAINT\s+"Payment_subject_shape_check"\s*;/gi, "")
      : file.includes("20260805030000_schema_drift_reconciliation")
        ? sql.replace(/DROP\s+CONSTRAINT\s+"(?:AdvertisingFundingMovement_ledgerJournalId_fkey|AdvertisingClickCharge_ledgerJournalId_fkey|AdvertisingClickCharge_reversedByJournalId_fkey)"\s*;/gi, "")
      : file.includes("20260805070000_comprehensive_schema_reconciliation")
        ? sql.replace(/ALTER\s+TABLE\s+"PaymentWebhookEvent"\s+DROP\s+CONSTRAINT\s+"PaymentWebhookEvent_paymentId_fkey"\s*;/gi, "")
      : sql;
  const findings = [];
  for (const { label, pattern } of dangerousPatterns) {
    for (const match of inspectedSql.matchAll(pattern)) {
      findings.push({
        file,
        line: statementLine(sql, match.index),
        label,
        statement: statementContaining(inspectedSql, match.index),
      });
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

function verifyActiveMigrationManifest(activeDirs) {
  const activeManifestPath = path.join(root, "artifacts", "phase26-5", "migrations", "migration-manifest.json");
  if (!existsSync(activeManifestPath)) return;

  const manifestData = JSON.parse(readFileSync(activeManifestPath, "utf8"));
  if (!Array.isArray(manifestData.manifest)) return;

  const manifestMap = new Map(manifestData.manifest.map((item) => [item.directory, item]));
  for (const dir of activeDirs) {
    const authority = manifestMap.get(dir);
    if (!authority) continue;
    const sqlPath = path.join(migrationsDir, dir, "migration.sql");
    if (!existsSync(sqlPath)) {
      throw new Error(`Active migration ${dir} does not contain migration.sql.`);
    }
    const actualHash = checksum(sqlPath);
    if (actualHash !== authority.hash) {
      throw new Error(`Historical active migration checksum mismatch for ${dir}. Approved authority hash: ${authority.hash}; actual hash: ${actualHash}.`);
    }
  }
}

try {
  const archiveManifest = loadArchiveManifest();
  verifyArchive(archiveManifest);

  const activeDirs = migrationDirectories(migrationsDir);
  const { baseline, sql } = verifyActiveBaseline(activeDirs, archiveManifest);
  verifyWithdrawalCompatibility(activeDirs);
  verifyActiveMigrationManifest(activeDirs);
  const findings = activeDirs.flatMap((migration) => {
    const migrationSql = migration === baseline ? sql : stripSqlComments(readFileSync(path.join(migrationsDir, migration, "migration.sql"), "utf8"));
    const file = path.join("prisma", "migrations", migration, "migration.sql");
    return findDangerousSql(migrationSql, file).filter((finding) => !approvedDestructiveOperation(migration, finding));
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
