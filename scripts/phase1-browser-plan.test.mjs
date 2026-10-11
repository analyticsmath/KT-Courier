import { test } from "node:test";
import assert from "node:assert/strict";
import { phase1BrowserPlan, browserStagePassed, discoveredBrowserTests } from "./phase1-browser-plan.mjs";

test("required native selections precede the full suite and retain failure artifacts separately", () => {
  const plan = phase1BrowserPlan(93);
  assert.deepEqual(plan.map(stage => [stage.name, stage.expectedTests]), [["storefront-variant-target", 1], ["storefront-product-detail", 4], ["catalog-1440", 2], ["catalog-both", 4], ["employee-1440", 1], ["employee-both", 2], ["full-chromium", 93]]);
  assert.ok(plan.slice(0, -1).every(stage => stage.args.some(arg => arg.endsWith(".spec.ts"))));
  assert.ok(plan.every(stage => stage.args.includes("--retries=0") && stage.args.includes("--workers=1")));
  assert.equal(new Set(plan.map(stage => stage.name)).size, plan.length);
});

test("full execution count comes from actual recursive project discovery", () => {
  const report = { suites: [{ specs: [{ tests: [{}, {}] }], suites: [{ specs: [{ tests: [{}] }] }] }] };
  assert.equal(discoveredBrowserTests(report), 3);
  assert.throws(() => discoveredBrowserTests({ suites: [] }));
  assert.throws(() => discoveredBrowserTests({ ...report, errors: [{}] }));
  assert.equal(browserStagePassed(phase1BrowserPlan().at(-1), 0, { expected: 0, unexpected: 0, skipped: 0, flaky: 0 }), false);
});

test("missing counts, omitted cases, skips, flaky results and nonzero exits refuse acceptance", () => {
  const stage = phase1BrowserPlan()[0];
  const clean = { expected: stage.expectedTests, unexpected: 0, skipped: 0, flaky: 0 };
  assert.equal(browserStagePassed(stage, 0, clean), true);
  for (const stats of [undefined, { ...clean, expected: 0 }, { ...clean, unexpected: 1 }, { ...clean, skipped: 1 }, { ...clean, flaky: 1 }]) assert.equal(browserStagePassed(stage, 0, stats), false);
  assert.equal(browserStagePassed(stage, 1, clean), false);
  assert.equal(browserStagePassed(stage, null, clean), false);
});
