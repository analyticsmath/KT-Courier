import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const activeDir = path.join(root, "prisma", "migrations");
const archiveDir = path.join(root, "prisma", "migrations-legacy-prebaseline");
const manifestPath = path.join(archiveDir, "manifest.json");
const readmePath = path.join(archiveDir, "README.md");

function checksum(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function migrationDirectories(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+_.+/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function fail(message) {
  throw new Error(message);
}

function archiveReadme() {
  return `# Legacy Prisma Migrations: Pre-Baseline Archive

## Why This Exists

These migration folders are preserved as an audit record of KT Couriers work completed before the project had a valid initial Prisma migration. The first legacy migration, \`20260611000000_phase_2_3_address_book\`, assumes base tables such as \`Address\` already exist, so the chain could not bootstrap an empty PostgreSQL database.

Git history did not contain a provable historical pre-first-migration schema. Rather than inventing that unknown history, the project consolidated its current Prisma datamodel into one new initial baseline before its first real deployment.

## Important Rules

- This directory is historical material only and is outside Prisma's active \`prisma/migrations/\` path.
- Do not pass this directory to \`prisma migrate deploy\` or \`prisma migrate dev\`.
- Do not edit archived SQL. Validate the immutable content with \`node scripts/check-migrations-safety.mjs\`.
- \`manifest.json\` records the original chronological order and SHA-256 digest of each \`migration.sql\` file.
`;
}

function main() {
  if (existsSync(archiveDir)) {
    fail(
      "Legacy migration archive already exists. Refusing a second run so archived content cannot be mixed or overwritten."
    );
  }

  const migrations = migrationDirectories(activeDir);
  if (migrations.length === 0) {
    fail("No active timestamped migrations found to archive.");
  }

  for (const name of migrations) {
    const sqlPath = path.join(activeDir, name, "migration.sql");
    if (!existsSync(sqlPath)) {
      fail(`Migration ${name} does not contain migration.sql.`);
    }
  }

  mkdirSync(archiveDir, { recursive: true });

  const manifestMigrations = migrations.map((name, index) => {
    const source = path.join(activeDir, name);
    const destination = path.join(archiveDir, name);
    cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });

    const sourceSql = path.join(source, "migration.sql");
    const archivedSql = path.join(destination, "migration.sql");
    const sourceChecksum = checksum(sourceSql);
    const archivedChecksum = checksum(archivedSql);
    if (sourceChecksum !== archivedChecksum) {
      fail(`Checksum mismatch while archiving ${name}. Active source was preserved.`);
    }

    return {
      order: index + 1,
      folder: name,
      sqlFile: "migration.sql",
      sha256: archivedChecksum,
    };
  });

  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        archive: "pre-production migration baseline consolidation",
        migrations: manifestMigrations,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  writeFileSync(readmePath, archiveReadme(), "utf8");

  for (const migration of manifestMigrations) {
    const sourceSql = path.join(activeDir, migration.folder, migration.sqlFile);
    const archivedSql = path.join(archiveDir, migration.folder, migration.sqlFile);
    if (checksum(sourceSql) !== checksum(archivedSql)) {
      fail(`Final checksum verification failed for ${migration.folder}. Active source was preserved.`);
    }
  }

  for (const migration of manifestMigrations) {
    rmSync(path.join(activeDir, migration.folder), { recursive: true, force: false });
  }

  console.log(`Archived ${manifestMigrations.length} legacy migration folder(s).`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
