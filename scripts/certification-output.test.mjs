import { test } from "node:test";
import assert from "node:assert/strict";
import { certificationEnvironmentProfile, certificationTestCounts, hasFlakyCriticalTests, hasSkippedCriticalTests, verifyCertificationHead } from "./certification-output.mjs";

test("the zero-marker static audit does not fail an entirely executed suite", () => {
  assert.equal(hasSkippedCriticalTests("Runtime [SKIP_TEST] markers: 0\nTests 3282 passed (3282)"), false);
});
test("executed skipped tests, todos and pending tests fail certification", () => {
  for (const output of ["Tests 7 passed | 1 skipped", "Tests 7 passed | 2 todo", "3 pending", "\u001b[33m1 skipped\u001b[0m"]) {
    assert.equal(hasSkippedCriticalTests(output), true);
  }
});
test("a real skip marker is still rejected even alongside the zero-marker audit", () => {
  for (const marker of ["[SKIP_TEST] unsafe fixture", "[SKIP_DB_EXECUTION] database absent", "Runtime [SKIP_TEST] markers: 1"]) {
    assert.equal(hasSkippedCriticalTests(`Runtime [SKIP_TEST] markers: 0\n${marker}`), true);
  }
});

test("an eventual retry success is not clean certification", () => {
  for (const output of ["1 flaky\n65 passed", "Tests 65 passed | 2 flaky", "\u001b[33m1 flaky\u001b[0m"]) assert.equal(hasFlakyCriticalTests(output), true);
});

test("a clean or explicitly zero-flaky result remains eligible", () => {
  for (const output of ["66 passed", "0 flaky\n66 passed", "0 skipped\n66 passed"]) assert.equal(hasFlakyCriticalTests(output), false);
});

test("Vitest failure-first summaries retain expected and executed counts", () => {
  const counts = certificationTestCounts("Test Files 2 failed | 18 passed (20)\nTests 2 failed | 158 passed (160)");
  assert.deepEqual(counts.executions, [{ runner: "vitest", testFiles: { passed: 18, failed: 2, skipped: 0, todo: 0, pending: 0, flaky: 0, expected: 20 }, passed: 158, failed: 2, skipped: 0, todo: 0, pending: 0, flaky: 0, expected: 160 }]);
  assert.equal(counts.testsExpected, 160);
  assert.equal(counts.testsExecuted, 160);
});

test("ordered Playwright summaries record every stage and identify the final executed suite", () => {
  const result = certificationTestCounts("Running 2 tests using 1 worker\n2 passed (5s)\nRunning 4 tests using 1 worker\n1 failed\n1 flaky\n1 skipped\n1 passed (9s)");
  assert.equal(result.executions.length, 2);
  assert.equal(result.executions[0].passed, 2);
  assert.equal(result.testsPassed, 1);
  assert.equal(result.testsFailed, 1);
  assert.equal(result.testsSkipped, 1);
  assert.equal(result.testsFlaky, 1);
  assert.equal(result.testsExpected, 4);
  assert.equal(result.testsExecuted, 4);
  assert.equal(certificationTestCounts("infrastructure failed before tests started").testsPassed, null);
});

test("partial Playwright list output preserves completed attempt counts when a final report is missing", () => {
  const result = certificationTestCounts([
    "Running 42 tests using 1 worker",
    "  ✓   1 [chromium] › customer wallet refunds (4s)",
    "  x   2 [chromium] › refund finance admin (2s)",
    "  -   3 [chromium] › skipped mobile-only case",
    "  ✓   4 [chromium] › retry title (retry #1) (5s)",
  ].join("\n"));

  assert.equal(result.testsExpected, 42);
  assert.equal(result.testsExecuted, null, "an interrupted run has no authoritative final test summary");
  assert.deepEqual(result.playwrightProgress, {
    passedAttempts: 2,
    failedAttempts: 1,
    skippedAttempts: 1,
    flakyAttempts: 1,
    completedAttempts: 4,
  });
});

test("certification environment receipts classify endpoints without retaining secrets", () => {
  assert.deepEqual(certificationEnvironmentProfile({
    DATABASE_URL: "postgresql://secret:secret@127.0.0.1:5432/disposable",
    KT_RUNTIME_ENV: "e2e",
    KT_NETWORK_DISABLED: "true",
    EMAIL_PROVIDER: "console",
    PAYSTACK_MODE: "test",
    PAYSTACK_SECRET_KEY: "never-include-this",
  }, "test:e2e"), {
    commandIsolation: "disposable-compose-runner",
    nodeEnvironment: "unset-or-other",
    runtimeEnvironment: "e2e",
    networkDisabled: true,
    databaseHostClass: "loopback",
    emailProvider: "console",
    paystackMode: "test",
  });
});

test("certification rejects missing, invalid or mismatched exact checkout identities", () => {
  const head = "a".repeat(40);
  assert.equal(verifyCertificationHead(head, head), head);
  assert.equal(verifyCertificationHead(head), head);
  for (const [actual, expected] of [[undefined, head], [head, "b".repeat(40)], ["abc", "abc"], [head, "HEAD"]]) assert.throws(() => verifyCertificationHead(actual, expected), /exact head SHA/);
});
