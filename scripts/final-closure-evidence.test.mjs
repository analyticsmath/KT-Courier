import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateFinalClosureEvidence } from "./final-closure-evidence.mjs";
const manifest = JSON.parse(readFileSync("docs/final-closure/final-acceptance.json", "utf8"));
const options = { root: process.cwd(), expectedSha: manifest.source.commitSha, launchGates: JSON.parse(readFileSync("docs/production-closure/engineering-gates.json", "utf8")).gates };
test("real source-bound dossier remains incomplete and fail-closed", () => { assert.equal(validateFinalClosureEvidence(manifest, options).launch, "NO_GO"); });
test("tampered count and receipt hash cannot become evidence", () => {
  for (const mutation of [m => { m.tests[0].testsPassed++; }, m => { m.tests[0].sha256 = "0".repeat(64); }]) { const changed = structuredClone(manifest); mutation(changed); assert.throws(() => validateFinalClosureEvidence(changed, options), /receipt/); }
});
test("pending approver and unauthorized launch are never inferred", () => {
  const changed = structuredClone(manifest); changed.gates[0].reviewer = "AI-approved"; assert.throws(() => validateFinalClosureEvidence(changed, options), /approval/);
  const launch = structuredClone(manifest); launch.launchClassification = "CUSTOMER_LAUNCH_GO"; assert.throws(() => validateFinalClosureEvidence(launch, options), /authorization/);
});
test("historical green receipts cannot certify a newer complete checkout", () => {
  const changed = structuredClone(manifest); changed.engineeringClassification = "ENGINEERING_COMPLETE";
  assert.throws(() => validateFinalClosureEvidence(changed, { ...options, expectedSha: "a".repeat(40) }), /exact checkout/);
});
