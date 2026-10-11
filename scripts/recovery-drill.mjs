import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { assertSuccess, composeArgs, findAvailableLoopbackPort, runCompose, runDocker, safeError, waitForServiceHealth } from "./docker-common.mjs";
const projectName = `kt-couriers-recovery-${Date.now()}-${process.pid}`;
const port = await findAvailableLoopbackPort();
const env = { ...process.env, NODE_ENV: "test", KT_RUNTIME_ENV: "e2e", POSTGRES_DB: "kt_recovery_source_test", POSTGRES_USER: "kt_recovery_test", POSTGRES_PASSWORD: "disposable_recovery_only", POSTGRES_PORT: String(port), DATABASE_URL: `postgresql://kt_recovery_test:disposable_recovery_only@localhost:${port}/kt_recovery_source_test?schema=public`, SHADOW_DATABASE_URL: `postgresql://kt_recovery_test:disposable_recovery_only@localhost:${port}/kt_recovery_shadow_test?schema=public`, KT_NETWORK_DISABLED: "true" };
const restored = "kt_recovery_restored_test"; const historical = "kt_recovery_historical_test";
let started = false; const evidence = { source: "DISPOSABLE_FIXTURES", dumpRestore: "NOT_RUN", historicalUpgrade: "NOT_RUN", protectedProductionDataTouched: false };
const compose = (args, input) => runCompose(args, { projectName, env, input });
const psql = (database, sql) => compose(["exec", "-T", "db", "psql", "-U", env.POSTGRES_USER, "-d", database, "-v", "ON_ERROR_STOP=1", "-At"], sql);
const migrate = (database, ...args) => {
  const url = new URL(env.DATABASE_URL); url.pathname = `/${database}`;
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", ...args], { env: { ...env, DATABASE_URL: url.toString() }, encoding: "utf8", shell: false });
  assertSuccess(result, `Migration ${args[0]}`);
};
try {
  assertSuccess(runDocker(["info"], { timeout: 20000 }), "Docker availability"); started = true;
  assertSuccess(compose(["up", "-d", "db"]), "Disposable source startup");
  if (await waitForServiceHealth("db", { projectName, env, timeoutMs: 120000 }) !== "healthy") throw new Error("Disposable source unhealthy.");
  migrate(env.POSTGRES_DB, "deploy");
  // Disposable representative data only; no dump is read from production.
  const fixture = `INSERT INTO "User" (id,email,name,"passwordHash",role,status,"createdAt","updatedAt") VALUES ('recovery-disposable-user','recovery@disposable.invalid','Recovery fixture','unusable-fixture-hash','CUSTOMER','ACTIVE',NOW(),NOW());`;
  assertSuccess(psql(env.POSTGRES_DB, fixture), "Representative disposable fixture");
  const ledgerFixture = `BEGIN;
    INSERT INTO "Wallet" (id,"ownerType","ownerId","updatedAt") VALUES ('recovery-disposable-wallet','PLATFORM','recovery-disposable-platform',NOW());
    INSERT INTO "LedgerAccount" (id,"walletId",code,purpose,category,"currentBalance","debitTotal","creditTotal","updatedAt") VALUES
      ('recovery-disposable-asset','recovery-disposable-wallet','RECOVERY_DISPOSABLE_ASSET','CASH_CLEARING','ASSET',10,10,0,NOW()),
      ('recovery-disposable-control','recovery-disposable-wallet','RECOVERY_DISPOSABLE_CONTROL','OPENING_BALANCE_CONTROL','EQUITY',10,0,10,NOW());
    INSERT INTO "LedgerJournal" (id,reference,type,"idempotencyKey","requestHash","policyVersion","totalDebits","totalCredits","createdByUserId") VALUES
      ('recovery-disposable-journal','RECOVERY_DISPOSABLE_JOURNAL','OPENING_BALANCE','recovery-disposable-opening',repeat('a',64),'disposable-recovery-only',10,10,'recovery-disposable-user');
    INSERT INTO "LedgerEntry" (id,"journalId","accountId",sequence,direction,amount,"lineCode") VALUES
      ('recovery-disposable-debit','recovery-disposable-journal','recovery-disposable-asset',1,'DEBIT',10,'DISPOSABLE_DEBIT'),
      ('recovery-disposable-credit','recovery-disposable-journal','recovery-disposable-control',2,'CREDIT',10,'DISPOSABLE_CREDIT');
    COMMIT;`;
  assertSuccess(psql(env.POSTGRES_DB, ledgerFixture), "Balanced disposable ledger fixture");
  const dump = spawnSync("docker", composeArgs(["exec", "-T", "db", "pg_dump", "-U", env.POSTGRES_USER, "-d", env.POSTGRES_DB, "--format=custom"], { projectName }), { env, encoding: null, maxBuffer: 100 * 1024 * 1024, shell: false });
  if (dump.status !== 0 || !dump.stdout?.length) throw new Error("Disposable dump failed.");
  assertSuccess(compose(["exec", "-T", "db", "createdb", "-U", env.POSTGRES_USER, restored]), "Fresh restore database");
  assertSuccess(compose(["exec", "-T", "db", "pg_restore", "-U", env.POSTGRES_USER, "-d", restored, "--exit-on-error", "--no-owner"], dump.stdout), "Restore into empty disposable database");
  migrate(restored, "status");
  const read = psql(restored, `SELECT count(*) FROM "User" WHERE id='recovery-disposable-user'; SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL; SELECT count(*) FROM "LedgerJournal" j WHERE (SELECT COALESCE(sum(CASE WHEN e.direction='DEBIT' THEN e.amount ELSE -e.amount END),0) FROM "LedgerEntry" e WHERE e."journalId"=j.id) <> 0; SELECT count(*) FROM "LedgerEntry" WHERE "journalId"='recovery-disposable-journal';`);
  assertSuccess(read, "Restored reads and ledger balancing");
  if (read.stdout.trim().replaceAll("\r\n", "\n") !== "1\n0\n0\n2") throw new Error("Restored representative reads or invariants failed.");
  const snapshotSql = ["User", "Wallet", "LedgerAccount", "LedgerJournal", "LedgerEntry"].map((table) => `SELECT count(*),md5(COALESCE(string_agg(row_to_json(t)::text,'|' ORDER BY t.id),'')) FROM "${table}" t;`).join("\n");
  const before = psql(env.POSTGRES_DB, snapshotSql); const after = psql(restored, snapshotSql);
  assertSuccess(before, "Source fixture snapshot"); assertSuccess(after, "Restored fixture snapshot");
  if (before.stdout.trim() !== after.stdout.trim()) throw new Error("Restored fixture counts or full-row hashes differ.");
  const invariantUrl = new URL(env.DATABASE_URL); invariantUrl.pathname = `/${restored}`;
  assertSuccess(spawnSync(process.execPath, ["scripts/verify-ledger-invariants.mjs"], { env: { ...env, DATABASE_URL: invariantUrl.toString() }, encoding: "utf8", shell: false }), "Restored ledger invariant suite");
  evidence.dumpRestore = "PASS"; evidence.fixtureCountsAndHashes = "MATCH"; evidence.ledgerInvariants = "PASS";
  assertSuccess(compose(["exec", "-T", "db", "createdb", "-U", env.POSTGRES_USER, historical]), "Fresh historical upgrade database");
  const baseline = readdirSync("prisma/migrations", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()[0];
  assertSuccess(psql(historical, readFileSync(`prisma/migrations/${baseline}/migration.sql`, "utf8")), "Historical baseline schema");
  assertSuccess(psql(historical, fixture), "Historical representative row");
  migrate(historical, "resolve", "--applied", baseline); migrate(historical, "deploy"); migrate(historical, "status");
  const upgraded = psql(historical, `SELECT count(*) FROM "User" WHERE id='recovery-disposable-user';`); assertSuccess(upgraded, "Historical row preservation");
  if (upgraded.stdout.trim() !== "1") throw new Error("Historical upgrade lost its representative row."); evidence.historicalUpgrade = "PASS";
} catch (error) { evidence.error = error instanceof Error ? error.message : "Recovery proof failed."; safeError(evidence.error); process.exitCode = 1; }
finally {
  if (started) { const cleanup = compose(["down", "-v", "--remove-orphans"]); if (cleanup.status !== 0) { evidence.cleanup = "FAIL"; process.exitCode = 1; } }
  mkdirSync("output/production-closure", { recursive: true }); writeFileSync("output/production-closure/recovery.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
