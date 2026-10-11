import { test } from "node:test";
import assert from "node:assert/strict";
import { phase1BrowserPlan, browserStagePassed, discoveredBrowserTests } from "./phase1-browser-plan.mjs";
import { readFileSync } from "node:fs";
import { DEFAULT_PLAYWRIGHT_TIMEOUT_MS, PHASE1_FULL_CHROMIUM_TIMEOUT_MS, PHASE2_3_DIRECTED_TIMEOUT_MS, PHASE2_3_DIRECTED_SPECS, e2eImageNames, isExactPhase2And3DirectedSelection, playwrightTimeoutMs } from "./e2e-runner-policy.mjs";

test("required native selections precede the full suite and retain failure artifacts separately", () => {
  const plan = phase1BrowserPlan(93);
  assert.deepEqual(plan.map(stage => [stage.name, stage.expectedTests]), [["storefront-variant-target", 1], ["storefront-product-detail", 4], ["catalog-1440", 2], ["catalog-both", 4], ["employee-1440", 1], ["employee-both", 2], ["full-chromium", 93]]);
  assert.ok(plan.slice(0, -1).every(stage => stage.args.some(arg => arg.endsWith(".spec.ts"))));
  assert.ok(plan.every(stage => stage.args.includes("--retries=0") && stage.args.includes("--workers=1")));
  assert.equal(new Set(plan.map(stage => stage.name)).size, plan.length);
  assert.equal(plan.at(-1).expectedTests, 93);
  assert.equal(PHASE1_FULL_CHROMIUM_TIMEOUT_MS, 45 * 60 * 1000);
});

test("the bounded directed timeout preserves the exact workflow selection and safety flags", () => {
  const workflow = readFileSync(new URL("../.github/workflows/production-certification.yml", import.meta.url), "utf8");
  const command = workflow.match(/node scripts\/certification-command\.mjs test:e2e -- (tests\/e2e\/.+?) --project=chromium --retries=0 --workers=1 --output=test-results\/phase2-3-directed/);
  assert.ok(command, "the required directed workflow command must remain present");
  assert.deepEqual(command[1].trim().split(/\s+/), PHASE2_3_DIRECTED_SPECS);

  const exactArgs = ["--", ...PHASE2_3_DIRECTED_SPECS, "--project=chromium", "--retries=0", "--workers=1", "--output=test-results/phase2-3-directed"];
  assert.equal(isExactPhase2And3DirectedSelection(exactArgs), true);
  assert.equal(playwrightTimeoutMs(exactArgs), PHASE2_3_DIRECTED_TIMEOUT_MS);
  assert.equal(PHASE2_3_DIRECTED_TIMEOUT_MS, 45 * 60 * 1000);
  assert.equal(playwrightTimeoutMs(exactArgs.filter((argument) => argument !== "--workers=1")), DEFAULT_PLAYWRIGHT_TIMEOUT_MS);
  assert.equal(playwrightTimeoutMs([...exactArgs, "tests/e2e/storefront-admin.spec.ts"]), DEFAULT_PLAYWRIGHT_TIMEOUT_MS);
});

test("disposable E2E image tags are unique and never use shared latest tags", () => {
  const first = e2eImageNames("1791677630665-21284");
  const second = e2eImageNames("1791677630666-21284");
  assert.deepEqual(first, {
    appImage: "kt-couriers-e2e-app:1791677630665-21284",
    migrateImage: "kt-couriers-e2e-migrate:1791677630665-21284",
  });
  assert.notDeepEqual(first, second);
  assert.ok(Object.values(first).every((tag) => !tag.endsWith(":latest")));
  assert.throws(() => e2eImageNames("UpperCase"));
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
