import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveHostHeapMb } from "./e2e-host-memory.mjs";

test("host build heap defaults to its existing limit and accepts a bounded override", () => {
  assert.equal(resolveHostHeapMb(undefined), 2500);
  assert.equal(resolveHostHeapMb("6144"), 6144);
  for (const invalid of ["0", "-1", "8193", "4.5", "4096 --unsafe", ""]) {
    assert.throws(() => resolveHostHeapMb(invalid));
  }
});
