import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { mandatoryGates } from "./phase3-evidence.mjs";

function refuse(reason) { throw new Error(`FINAL_CLOSURE_EVIDENCE_INVALID: ${reason}`); }
export function validateFinalClosureEvidence(manifest, { root, expectedSha, launchGates }) {
  if (manifest.schemaVersion !== 1 || manifest.source?.branch !== "main" || !/^[a-f0-9]{40}$/.test(manifest.source?.commitSha ?? "") || !/^[a-f0-9]{40}$/.test(manifest.source?.treeSha ?? "")) refuse("source");
  if (manifest.noCloudStaging !== "NO_CLOUD_STAGING_BY_OWNER_DIRECTION") refuse("owner staging direction");
  const complete = manifest.engineeringClassification === "ENGINEERING_COMPLETE";
  if (!complete && manifest.engineeringClassification !== "ENGINEERING_INCOMPLETE") refuse("engineering classification");
  if (complete && manifest.source.commitSha !== expectedSha) refuse("complete evidence must match exact checkout");
  if (!Array.isArray(manifest.gates) || manifest.gates.length !== mandatoryGates.length || new Set(manifest.gates.map(g => g.key)).size !== mandatoryGates.length) refuse("gate inventory");
  for (const key of mandatoryGates) {
    const gate = manifest.gates.find(g => g.key === key), canonical = launchGates.find(g => g.key === key);
    if (!gate || !canonical || gate.launchState !== canonical.status || !["IMPLEMENTED", "INCOMPLETE"].includes(gate.engineeringState) || !gate.externalOwner || !gate.evidenceRefs?.length) refuse("gate source authority");
    if (gate.launchState !== "IMPLEMENTED" && (gate.reviewer !== null || gate.reviewedAt !== null)) refuse("invented pending approval");
    if (complete && gate.engineeringState !== "IMPLEMENTED") refuse("incomplete engineering gate");
  }
  const open = manifest.gates.some(g => g.launchState !== "IMPLEMENTED");
  if (open && (manifest.launchClassification !== "NO_GO" || manifest.releaseClassification !== "RELEASE_NOT_AUTHORIZED")) refuse("launch authorization");
  if (!Array.isArray(manifest.tests) || !manifest.tests.length) refuse("test inventory");
  const folder = path.resolve(root, "docs/final-closure");
  const seen = new Set();
  for (const entry of manifest.tests) {
    if (seen.has(entry.path) || typeof entry.path !== "string" || !entry.path.startsWith("receipts/")) refuse("receipt inventory"); seen.add(entry.path);
    const target = path.resolve(folder, entry.path);
    if (!target.startsWith(folder + path.sep)) refuse("receipt traversal");
    const bytes = readFileSync(target), receipt = JSON.parse(bytes);
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) refuse("receipt digest");
    for (const key of ["command", "commitSha", "sourceTreeSha", "status", "testsExpected", "testsExecuted", "testsPassed", "testsFailed", "testsSkipped", "testsFlaky"]) if (entry[key] !== receipt[key]) refuse("receipt fields");
    if (!/^[a-f0-9]{40}$/.test(receipt.commitSha ?? "") || !/^[a-f0-9]{40}$/.test(receipt.sourceTreeSha ?? "")) refuse("receipt source");
    if (receipt.status === "PASS" && (receipt.process?.exitCode !== 0 || receipt.testsFailed !== 0 || receipt.testsSkipped !== 0 || receipt.testsFlaky !== 0 || !Number.isSafeInteger(receipt.testsPassed) || receipt.testsPassed < 1 || receipt.testsExpected !== receipt.testsPassed || receipt.testsExecuted !== receipt.testsPassed)) refuse("false pass or incomplete counts");
    if (complete && (receipt.status !== "PASS" || receipt.commitSha !== expectedSha)) refuse("complete test evidence");
  }
  return { classification: manifest.engineeringClassification, launch: manifest.launchClassification, receipts: manifest.tests.length, openLaunchGates: manifest.gates.filter(g => g.launchState !== "IMPLEMENTED").length };
}
