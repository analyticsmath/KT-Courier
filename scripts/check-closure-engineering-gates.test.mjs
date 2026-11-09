import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { evaluateLaunchGateManifest } from "./check-closure-engineering-gates.mjs";

const gate = (key, status = "IMPLEMENTED") =>
  ({ key, status, evidence: "Audited source and independent evidence." });

test("all complete gates still require explicit READY classification", () => {
  const pending = evaluateLaunchGateManifest({
    classification: "NOT_READY", gates: [gate("parcel_checkout")],
  });
  assert.equal(pending.implemented, 1);
  assert.equal(pending.ready, false);
  const approved = evaluateLaunchGateManifest({
    classification: "READY", gates: [gate("parcel_checkout")],
  });
  assert.equal(approved.ready, true);
});

test("any open or blocked commercial fact vetoes READY rather than changing it", () => {
  const result = evaluateLaunchGateManifest({
    classification: "READY",
    gates: [
      gate("parcel_checkout"),
      gate("store_payment", "OPEN"),
      gate("bank_reconciliation", "VALIDATION_BLOCKED"),
    ],
  });
  assert.equal(result.ready, false);
  assert.equal(result.implemented, 1);
  assert.deepEqual(result.unresolved.map(x => x.key), ["store_payment", "bank_reconciliation"]);
});

test("duplicate, empty evidence, unknown status and absent registry never authorize launch", () => {
  const invalid = [
    null,
    { classification: "READY", gates: [] },
    { classification: "READY", gates: [gate("same"), gate("same")] },
    { classification: "READY", gates: [{ ...gate("x"), evidence: " " }] },
    { classification: "READY", gates: [{ ...gate("x"), status: "SKIPPED" }] },
    { classification: "UNKNOWN", gates: [gate("x")] },
  ];
  for (const manifest of invalid) {
    assert.throws(() => evaluateLaunchGateManifest(manifest));
  }
});

test("the current production source gate produces an honest veto and machine-readable receipt", () => {
  const registered = JSON.parse(readFileSync("docs/production-closure/engineering-gates.json", "utf8"));
  const verdict = evaluateLaunchGateManifest(registered);
  if (verdict.ready) return; // The same test remains valid after real approval.
  const cli = spawnSync(process.execPath, ["scripts/check-closure-engineering-gates.mjs"], {
    cwd: process.cwd(), encoding: "utf8",
    env: { ...process.env, KT_CERTIFICATION_HEAD_SHA: "" },
  });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /NOT_READY/);
  const receipt = JSON.parse(readFileSync("output/production-closure/phase3-launch-veto.json", "utf8"));
  assert.equal(receipt.launchAuthorized, false);
  assert.equal(receipt.evidenceTier, "SOURCE_REGISTRY_ONLY");
  assert.equal(receipt.gateCounts.unresolved, verdict.unresolved.length);
  assert.deepEqual(receipt.unresolved.map(x => x.key), verdict.unresolved.map(x => x.key));
});
