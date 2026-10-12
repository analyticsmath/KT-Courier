import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mandatoryGates, validatePhase3Evidence } from "./phase3-evidence.mjs";

const commitSha = "a".repeat(40), treeSha = "b".repeat(40);
const manifest = () => ({ schemaVersion: 1, source: { repo: "analyticsmath/KT-Courier", branch: "main", commitSha, treeSha }, checkedAtUtc: new Date().toISOString(), classification: "ENGINEERING_IN_PROGRESS", releaseDecision: "NO_GO", tests: [], gates: mandatoryGates.map(key => ({ key, status: "OPEN", engineeringProof: [], operatorApproval: null })), blockers: ["Synthetic fixture: no launch approval"] });
test("incomplete evidence is valid only as explicitly incomplete NO_GO", () => {
  assert.equal(validatePhase3Evidence(manifest()).releaseDecision, "NO_GO");
  for (const mutate of [m => { m.classification = "ENGINEERING_COMPLETE"; }, m => { m.releaseDecision = "GO"; }, m => { m.gates.pop(); }, m => { m.gates[1] = m.gates[0]; }, m => { m.source.branch = "other"; }]) {
    const m = manifest(); mutate(m); assert.throws(() => validatePhase3Evidence(m, { expectedSha: commitSha }), /INVALID/);
  }
});
test("PASS requires real source-bound hash-verified zero-skip artifacts", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kt-phase3-evidence-"));
  try {
    mkdirSync(path.join(root, "receipts"));
    const receipt = { commitSha, sourceTreeSha: treeSha, status: "PASS", testsPassed: 2, testsFailed: 0, testsSkipped: 0, testsFlaky: 0, process: { exitCode: 0 } };
    const bytes = JSON.stringify(receipt); writeFileSync(path.join(root, "receipts", "test.json"), bytes);
    const m = manifest(); m.tests.push({ name: "synthetic", status: "PASS", command: "synthetic", commitSha, providerMode: "offline", expected: 2, passed: 2, failed: 0, skipped: 0, flaky: 0, artifact: "receipts/test.json", artifactSha256: createHash("sha256").update(bytes).digest("hex") });
    assert.equal(validatePhase3Evidence(m, { root }).passingSelections, 1);
    for (const extra of [{ skipped: 1 }, { passed: 1 }, { expected: 0 }, { artifact: "receipts/missing.json" }, { artifact: "../test.json" }, { artifactSha256: "c".repeat(64) }, { commitSha: "d".repeat(40) }, { runUrl: "https://example.invalid/actions/1" }]) {
      assert.throws(() => validatePhase3Evidence({ ...m, tests: [{ ...m.tests[0], ...extra }] }, { root }), /INVALID/);
    }
    writeFileSync(path.join(root, "receipts", "test.json"), JSON.stringify({ ...receipt, testsSkipped: 1 }));
    assert.throws(() => validatePhase3Evidence(m, { root }), /INVALID/);
  } finally { rmSync(root, { recursive: true }); }
});
test("gate drift and unsigned claimed acceptance fail", () => {
  const m = manifest(); assert.throws(() => validatePhase3Evidence(m, { launchGates: [] }), /drift/);
  m.gates[0].operatorApproval = {}; assert.throws(() => validatePhase3Evidence(m), /authority/);
});
