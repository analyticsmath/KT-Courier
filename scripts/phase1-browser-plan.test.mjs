import { test } from "node:test";
import assert from "node:assert/strict";
import { phase1BrowserPlan, browserStagePassed } from "./phase1-browser-plan.mjs";

test("required native selections precede the full suite and retain failure artifacts separately", () => {
  const plan = phase1BrowserPlan();
  assert.deepEqual(plan.map(stage => [stage.name, stage.expectedTests]), [["catalog-1440", 2], ["catalog-both", 4], ["employee-1440", 1], ["employee-both", 2], ["full-chromium", 88]]);
  assert.ok(plan.slice(0, 4).every(stage => stage.args.some(arg => arg.endsWith(".spec.ts"))));
  assert.ok(plan.every(stage => stage.args.includes("--retries=0") && stage.args.includes("--workers=1")));
  assert.equal(new Set(plan.map(stage => stage.name)).size, plan.length);
});

test("missing counts, omitted cases, skips, flaky results and nonzero exits refuse acceptance", () => {
  const stage = phase1BrowserPlan()[0];
  const clean = { expected: 2, unexpected: 0, skipped: 0, flaky: 0 };
  assert.equal(browserStagePassed(stage, 0, clean), true);
  for (const stats of [undefined, { ...clean, expected: 1 }, { ...clean, unexpected: 1 }, { ...clean, skipped: 1 }, { ...clean, flaky: 1 }]) assert.equal(browserStagePassed(stage, 0, stats), false);
  assert.equal(browserStagePassed(stage, 1, clean), false);
  assert.equal(browserStagePassed(stage, null, clean), false);
});
