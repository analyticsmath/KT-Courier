import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";

const source = readFileSync(new URL("../.github/workflows/production-certification.yml", import.meta.url), "utf8");
const workflow = yaml.load(source);

test("every main PR update is eligible, with dispatch and approved release tags preserved", () => {
  assert.deepEqual(workflow.on.pull_request.branches, ["main"]);
  for (const filter of ["paths", "paths-ignore", "branches-ignore", "types"]) assert.equal(filter in workflow.on.pull_request, false);
  assert.equal("workflow_dispatch" in workflow.on, true);
  assert.deepEqual(workflow.on.push.tags, ["release-*"]);
});

test("all certification jobs check out the same exact PR head or dispatch/tag SHA", () => {
  assert.equal(workflow.env.KT_CERTIFICATION_HEAD_SHA, "${{ github.event.pull_request.head.sha || github.sha }}");
  for (const [name, job] of Object.entries(workflow.jobs)) {
    const checkout = job.steps.find(step => step.uses === "actions/checkout@v4");
    assert.equal(checkout?.with?.ref, "${{ env.KT_CERTIFICATION_HEAD_SHA }}", name);
  }
});

test("separate observable disposable jobs, strict browser plan and final manifest gates remain", () => {
  assert.deepEqual(workflow.jobs.certified.needs, ["quality", "postgres", "redis-and-recovery", "recovery", "browser"]);
  assert.equal(workflow.jobs.postgres.services.postgres.env.POSTGRES_DB, "kt_launch_test");
  assert.equal(workflow.env.KT_NETWORK_DISABLED, "true");
  assert.equal(workflow.env.PAYSTACK_ACTIVE, "false");
  assert.match(source, /certification-command\.mjs test:e2e -- --project=chromium --phase1-catalog/);
  assert.match(source, /check-closure-engineering-gates\.mjs/);
  assert.doesNotMatch(source, /secrets\.|continue-on-error/);
  assert.equal(workflow.jobs.postgres.strategy["fail-fast"], false);
  assert.equal(workflow.jobs.postgres.strategy.matrix.command.length, 20);
});

test("finance targets use a separate disposable invocation before the unchanged full browser plan", () => {
  const steps = workflow.jobs.browser.steps;
  const focused = steps.findIndex(step => step.name?.startsWith("Isolated withdrawal finance acceptance"));
  const full = steps.findIndex(step => step.run?.includes("test:e2e -- --project=chromium --phase1-catalog"));
  assert.ok(focused >= 0 && full > focused);
  assert.match(steps[focused].run, /certification-command\.mjs test:e2e -- tests\/e2e\/withdrawal-finance-admin\.spec\.ts --project=chromium --retries=0 --workers=1/);
  for (const guard of ["result.commitSha!==process.env.KT_CERTIFICATION_HEAD_SHA", "result.status!=='PASS'", "result.testsPassed!==3", "result.testsFailed!==0", "result.testsSkipped!==0", "result.testsFlaky!==0"]) assert.ok(steps[focused].run.includes(guard), guard);
  assert.match(steps[focused].run, /test-e2e-finance-focused\.json/);
  const planSource = readFileSync(new URL("./phase1-browser-plan.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(planSource, /withdrawal-finance-admin\.spec\.ts/);
});
