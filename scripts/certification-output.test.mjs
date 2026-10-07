import { test } from "node:test";
import assert from "node:assert/strict";
import { hasFlakyCriticalTests, hasSkippedCriticalTests } from "./certification-output.mjs";

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
