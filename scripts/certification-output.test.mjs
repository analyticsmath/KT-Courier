import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSkippedCriticalTests } from "./certification-output.mjs";

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
