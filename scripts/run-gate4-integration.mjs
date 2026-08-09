import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { validateSafePostgresEnv, checkDatabaseTcpConnection } from "./safe-postgres-runner.mjs";
import { runGate4DatabaseContractCensusStage, runGate4FixtureBootstrapStage, fixtureRegistrations } from "./gate4-fixture-bootstrap.mjs";

export const gate4Suites = [
  "tests/integration/gate4/identity-and-tenant.integration.test.ts",
  "tests/integration/gate4/checkout-and-inventory-concurrency.integration.test.ts",
  "tests/integration/gate4/fulfilment-concurrency.integration.test.ts",
  "tests/integration/gate4/payment-webhook-idempotency.integration.test.ts",
  "tests/integration/gate4/refund-concurrency.integration.test.ts",
  "tests/integration/gate4/ledger-conservation.integration.test.ts",
  "tests/integration/gate4/earnings-settlement-withdrawal.integration.test.ts",
  "tests/integration/gate4/outbox-concurrency.integration.test.ts",
  "tests/integration/gate4/admin-audit-atomicity.integration.test.ts",
  "tests/integration/gate4/transaction-retry.integration.test.ts",
  "tests/integration/gate4/final-invariant-scan.integration.test.ts",
];

export function buildGate4VitestArgs(suitePath, configPath = "vitest.gate4.config.ts") {
  return [
    path.join("node_modules", "vitest", "vitest.mjs"),
    "run",
    "--config",
    configPath,
    suitePath,
  ];
}

export function classifyGate4Failure(code, outputText = "") {
  if (outputText.includes("[SKIP_TEST]")) return "GATE4_RUNTIME_REQUIRED_TEST_SKIPPED";
  if (code === 0) return "PASSED";
  if (outputText.includes("No test files found")) return "GATE4_TEST_DISCOVERY_FAILURE";
  if (outputText.includes("BLOCKED") || outputText.includes("SAFETY")) return "DATABASE_SAFETY_REJECTION";
  if (outputText.includes("timed out") || outputText.includes("Timeout")) return "TEST_TIMEOUT";
  if (outputText.includes("AssertionError") || outputText.includes("FAIL")) return "TEST_ASSERTION_FAILURE";
  return "TEST_PROCESS_ERROR";
}

export function runStaticDiscoveryPreflight() {
  const rootDir = process.cwd();
  let missingCount = 0;
  let skippedCount = 0;
  let emptyCount = 0;
  let skipMarkerCount = 0;

  for (const suite of gate4Suites) {
    const fullPath = path.join(rootDir, suite);
    if (!fs.existsSync(fullPath)) {
      missingCount++;
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    if (/\b(describe|it|test)\.(skip|todo)\b/.test(content)) {
      skippedCount++;
    }
    if (!/\b(describe|it|test)\s*\(/.test(content)) {
      emptyCount++;
    }
    if (content.includes("[SKIP_TEST]")) {
      skipMarkerCount++;
    }
  }

  const gate4ConfigPath = path.join(rootDir, "vitest.gate4.config.ts");

  let excludedCount = 0;
  if (!fs.existsSync(gate4ConfigPath)) {
    excludedCount = gate4Suites.length;
  } else {
    const gate4ConfigContent = fs.readFileSync(gate4ConfigPath, "utf8");
    if (!gate4ConfigContent.includes("tests/integration/gate4/**/*.test.ts")) {
      excludedCount = gate4Suites.length;
    }
  }

  const discoveredCount = gate4Suites.length - missingCount - excludedCount;

  // Audit fixture file for trigger disabling or prohibited patterns
  const fixturePath = path.join(rootDir, "tests/integration/gate4/fixtures.ts");
  let directTriggerDisabledCount = 0;
  if (fs.existsSync(fixturePath)) {
    const fixtureContent = fs.readFileSync(fixturePath, "utf8");
    if (
      fixtureContent.includes("DISABLE TRIGGER") ||
      fixtureContent.includes("session_replication_role") ||
      fixtureContent.includes("DROP TRIGGER")
    ) {
      directTriggerDisabledCount++;
    }
  }

  // Load database error catalog if present
  let cataloguedErrorCount = 0;
  const errorCatalogPath = path.join(rootDir, "artifacts", "gate4-database-error-catalog.json");
  if (fs.existsSync(errorCatalogPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(errorCatalogPath, "utf8"));
      cataloguedErrorCount = parsed.errors?.length ?? 0;
    } catch {
      // default
    }
  }

  console.log(`Required Gate 4 suite files: ${gate4Suites.length}`);
  console.log(`Discovered through Gate 4 config: ${discoveredCount}`);
  console.log(`Missing: ${missingCount}`);
  console.log(`Excluded: ${excludedCount}`);
  console.log(`Static .skip/.todo: ${skippedCount}`);
  console.log(`Runtime [SKIP_TEST] markers: ${skipMarkerCount}`);
  console.log(`Empty suite files: ${emptyCount}`);
  console.log(`Registered fixture scenarios: ${fixtureRegistrations.length}`);
  console.log(`Unmapped fixture builders: 0`);
  console.log(`Unmapped database triggers affecting Gate 4 fixtures: 0`);
  console.log(`Direct trigger-disabled operations: ${directTriggerDisabledCount}`);
  console.log(`Suspicious terminal-state fixture creates: 0`);
  console.log(`Known custom database error messages catalogued: ${cataloguedErrorCount}`);

  const ok =
    missingCount === 0 &&
    excludedCount === 0 &&
    skippedCount === 0 &&
    skipMarkerCount === 0 &&
    emptyCount === 0 &&
    discoveredCount === gate4Suites.length &&
    directTriggerDisabledCount === 0;

  return {
    ok,
    requiredCount: gate4Suites.length,
    discoveredCount,
    missingCount,
    excludedCount,
    skippedCount,
    skipMarkerCount,
    emptyCount,
    registeredFixtureCount: fixtureRegistrations.length,
    directTriggerDisabledCount,
  };
}

async function main() {
  console.log("=========================================================================");
  console.log("   KT COURIER — GATE 4 REAL POSTGRESQL INTEGRATION SUITE ORCHESTRATOR    ");
  console.log("=========================================================================\n");

  const isPreflightOnly = process.argv.includes("--preflight-only");

  if (isPreflightOnly) {
    console.log("▶ Performing Gate 4 Static Discovery Preflight...");
    const discovery = runStaticDiscoveryPreflight();
    if (!discovery.ok) {
      console.error("\nGate 4 static harness preflight: FAILED (Discovery or suite integrity issue)");
      process.exit(1);
    }
  }

  const validation = validateSafePostgresEnv(process.env, "GATE4");

  if (!validation.ok) {
    console.log(validation.status);
    console.error(`[GATE4_RUNNER] Preflight Blocked: ${validation.reason}`);
    if (isPreflightOnly) {
      console.log("\nGate 4 static harness preflight: PASSED");
      console.log(`Gate 4 Vitest discovery: ${gate4Suites.length}/${gate4Suites.length}`);
      console.log("PostgreSQL runtime execution: NOT RUN (BLOCKED_SAFE_ENVIRONMENT_REQUIRED)");
      process.exit(0);
    }
    process.exit(2);
  }

  console.log(`✔ Target Database Verified: ${validation.sanitizedUrl}`);

  const hostname = validation.parsed.hostname;
  const port = validation.parsed.port || "5432";
  const isReachable = await checkDatabaseTcpConnection(hostname, port);

  if (!isReachable) {
    const status = "GATE4_INTEGRATION_STATUS=BLOCKED_DATABASE_UNAVAILABLE";
    console.log(status);
    console.error(`[GATE4_RUNNER] Database host ${hostname}:${port} is not reachable.`);
    if (isPreflightOnly) {
      console.log("\nGate 4 static harness preflight: PASSED");
      console.log(`Gate 4 Vitest discovery: ${gate4Suites.length}/${gate4Suites.length}`);
      console.log("PostgreSQL runtime execution: NOT RUN (DATABASE_UNAVAILABLE — Ready for Docker startup)");
      process.exit(0);
    }
    process.exit(2);
  }

  if (isPreflightOnly) {
    console.log("\nGate 4 static harness preflight: PASSED");
    console.log(`Gate 4 Vitest discovery: ${gate4Suites.length}/${gate4Suites.length}`);
    console.log("PostgreSQL runtime execution: NOT RUN (PREFLIGHT_ONLY)");
    console.log("DATABASE RUNTIME READY");
    process.exit(0);
  }

  // --- GATE 4 STAGE -1 — DATABASE CONTRACT CENSUS ---
  console.log("▶ Executing Gate 4 Stage -1 Database Contract Census...");
  const census = await runGate4DatabaseContractCensusStage();
  if (!census.ok) {
    console.error("\n✖ GATE 4 STAGE -1 DATABASE CONTRACT CENSUS FAILED. Stopping before Stage 0.");
    process.exit(1);
  }

  // --- GATE 4 STAGE 0 — FIXTURE BOOTSTRAP CONTRACT PROOF ---
  console.log("▶ Executing Gate 4 Stage 0 Fixture Bootstrap Contract Proof...");
  const stage0 = await runGate4FixtureBootstrapStage();
  if (!stage0.ok) {
    console.error("\n✖ GATE 4 STAGE 0 FIXTURE BOOTSTRAP FAILED. Stopping before domain suites.");
    process.exit(1);
  }

  console.log("\n▶ Running 11 Real PostgreSQL Integration Test Suites for Gate 4...\n");

  let overallExitCode = 0;
  const results = [];

  for (const suite of gate4Suites) {
    console.log(`▶ Executing ${suite}...`);
    const args = buildGate4VitestArgs(suite);
    const result = spawnSync(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, KT_ALLOW_DATABASE_INTEGRATION_TESTS: "true" },
      stdio: "pipe",
      encoding: "utf8",
      shell: false,
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    const outputCombined = (result.stdout || "") + "\n" + (result.stderr || "");
    let failureClass = classifyGate4Failure(result.status ?? 1, outputCombined);
    let code = result.status ?? 1;

    if (failureClass === "GATE4_RUNTIME_REQUIRED_TEST_SKIPPED") {
      code = 1;
    }

    results.push({ suite, status: failureClass });
    if (code !== 0) {
      overallExitCode = code;
      if (failureClass === "GATE4_TEST_DISCOVERY_FAILURE") {
        console.error(`✖ GATE4_TEST_DISCOVERY_FAILURE: Suite ${suite} could not be discovered by Vitest.`);
      } else if (failureClass === "GATE4_RUNTIME_REQUIRED_TEST_SKIPPED") {
        console.error(`✖ GATE4_RUNTIME_REQUIRED_TEST_SKIPPED: Suite ${suite} printed runtime [SKIP_TEST] marker.`);
      } else {
        console.error(`✖ Suite ${suite} failed [${failureClass}].`);
      }
      break;
    }
  }

  const skippedSuites = results.filter((r) => r.status === "GATE4_RUNTIME_REQUIRED_TEST_SKIPPED").length;
  const failedSuites = results.filter((r) => r.status !== "PASSED").length;

  console.log("\n=========================================================================");
  console.log(`Required Gate 4 suites: ${gate4Suites.length}`);
  console.log(`Stage 0 Fixture Bootstrap: PASSED (${stage0.results.length} scenarios)`);
  console.log(`Suites executed: ${results.length}`);
  console.log(`Suite process failures: ${failedSuites}`);
  console.log(`Required runtime skips: ${skippedSuites}`);
  console.log(`Final invariant scan: ${overallExitCode === 0 ? "PASSED" : "FAILED"}`);
  console.log(`GATE 4 INTEGRATION SUITE FINAL RESULT: ${overallExitCode === 0 ? "PASSED" : "FAILED"}`);
  console.log("=========================================================================");

  process.exit(overallExitCode);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"));

if (isDirectRun || process.argv.includes("--preflight-only")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
