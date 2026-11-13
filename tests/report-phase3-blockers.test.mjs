import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildBlockerActions } from "../scripts/report-phase3-blockers.mjs";

const gate = (key, status = "OPEN") => ({ key, status, evidence: "Internal historical evidence, not a new approval." });
test("maps each unresolved gate to accountable actions without authorizing launch", () => {
  const manifest = JSON.parse(readFileSync("docs/production-closure/engineering-gates.json", "utf8"));
  const report = buildBlockerActions(manifest, "a".repeat(40));
  assert.equal(report.launchAuthorized, false);
  assert.equal(report.actions.length, manifest.gates.filter(x => x.status !== "IMPLEMENTED").length);
  for (const item of report.actions) for (const field of ["key", "status", "owner", "evidenceRequired", "nextAction"]) assert.ok(typeof item[field] === "string" && item[field].trim(), `${item.key}: ${field}`);
  assert.doesNotMatch(JSON.stringify(report), /Internal historical evidence/);
});
test("refuses malformed manifests and unknown unresolved gate keys", () => {
  for (const manifest of [null, { classification: "READY", gates: [] }, { classification: "NOT_READY", gates: [gate("unknown_gate")] }, { classification: "NOT_READY", gates: [gate("marketplace_parcel_classification"), gate("marketplace_parcel_classification")] }]) {
    assert.throws(() => buildBlockerActions(manifest, "a".repeat(40)));
  }
  assert.throws(() => buildBlockerActions({ classification: "NOT_READY", gates: [gate("marketplace_parcel_classification")] }, "short"));
});
test("diagnostic succeeds without claiming launch authorization", () => {
  const diagnostic = spawnSync(process.execPath, ["scripts/report-phase3-blockers.mjs"], { encoding: "utf8" });
  assert.equal(diagnostic.status, 0, diagnostic.stderr);
  const result = JSON.parse(readFileSync("output/production-closure/phase3-blocker-actions.json", "utf8"));
  assert.equal(result.launchAuthorized, false);
  assert.equal(result.classification, "NOT_READY");
  assert.ok(result.actions.length > 0);
});
