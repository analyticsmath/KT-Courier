import { test } from "node:test";
import assert from "node:assert/strict";
import { certificationTestCounts, hasFlakyCriticalTests, hasSkippedCriticalTests, verifyCertificationHead } from "./certification-output.mjs";

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

test("Vitest failure-first summaries still retain executed passing and failing counts", () => {
  assert.deepEqual(certificationTestCounts("Test Files 2 failed | 18 passed (20)\nTests 2 failed | 158 passed (160)").executions, [{ runner: "vitest", testFiles: { passed: 18, failed: 2, skipped: 0, todo: 0, pending: 0, flaky: 0 }, passed: 158, failed: 2, skipped: 0, todo: 0, pending: 0, flaky: 0 }]);
});

test("ordered Playwright summaries record every stage and identify the final executed suite", () => {
  const result = certificationTestCounts("Running 2 tests using 1 worker\n2 passed (5s)\nRunning 4 tests using 1 worker\n1 failed\n1 flaky\n1 skipped\n1 passed (9s)");
  assert.equal(result.executions.length, 2);
  assert.equal(result.executions[0].passed, 2);
  assert.equal(result.testsPassed, 1);
  assert.equal(result.testsFailed, 1);
  assert.equal(result.testsSkipped, 1);
  assert.equal(result.testsFlaky, 1);
  assert.equal(certificationTestCounts("infrastructure failed before tests started").testsPassed, null);
});

test("certification rejects missing, invalid or mismatched exact checkout identities", () => {
  const head = "a".repeat(40);
  assert.equal(verifyCertificationHead(head, head), head);
  assert.equal(verifyCertificationHead(head), head);
  for (const [actual, expected] of [[undefined, head], [head, "b".repeat(40)], ["abc", "abc"], [head, "HEAD"]]) assert.throws(() => verifyCertificationHead(actual, expected), /exact head SHA/);
});
