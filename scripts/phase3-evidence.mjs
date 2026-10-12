import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

export const mandatorySelections = ["quality", "coverage", "postgres", "redis", "recovery", "browser-directed", "browser-finance", "browser-paystack", "browser-full", "browser-canonical", "staging"];
export const mandatoryGates = ["marketplace_parcel_classification", "notification_required_domains", "commercial_financial_certification", "customer_vendor_driver_full_functional_acceptance", "visual_acceptance", "media_full_functional_acceptance", "critical_skip_closure", "fresh_production_protected_row_audit", "github_certification_and_deployment"];
const sha = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const refusal = reason => { throw new Error(`PHASE3_EVIDENCE_INVALID: ${reason}`); };

export function validatePhase3Evidence(manifest, { root, expectedSha, launchGates } = {}) {
  if (manifest?.schemaVersion !== 1 || manifest.source?.repo !== "analyticsmath/KT-Courier" || manifest.source?.branch !== "main" ||
      !sha(manifest.source?.commitSha) || !sha(manifest.source?.treeSha) || !Number.isFinite(Date.parse(manifest.checkedAtUtc))) refusal("source identity");
  if (!["ENGINEERING_IN_PROGRESS", "ENGINEERING_INCOMPLETE", "ENGINEERING_COMPLETE"].includes(manifest.classification)) refusal("classification");
  if (!["NO_GO", "GO"].includes(manifest.releaseDecision)) refusal("release decision");
  if (!Array.isArray(manifest.tests) || !Array.isArray(manifest.gates) || !Array.isArray(manifest.blockers)) refusal("inventory");
  const keys = manifest.gates.map(gate => gate.key);
  if (new Set(keys).size !== keys.length || keys.length !== mandatoryGates.length || mandatoryGates.some(key => !keys.includes(key))) refusal("gate inventory");
  for (const gate of manifest.gates) {
    if (!["OPEN", "VALIDATION_BLOCKED", "IMPLEMENTED"].includes(gate.status)) refusal("gate status");
    if (launchGates && launchGates.find(row => row.key === gate.key)?.status !== gate.status) refusal("gate drift");
    if (!Array.isArray(gate.engineeringProof) || !(gate.operatorApproval === null ||
        gate.operatorApproval?.reviewer && gate.operatorApproval?.scope && gate.operatorApproval?.evidenceRef && Number.isFinite(Date.parse(gate.operatorApproval?.reviewedAt)))) refusal("gate authority");
  }
  const names = new Set();
  for (const selection of manifest.tests) {
    if (!selection.name || names.has(selection.name)) refusal("test inventory"); names.add(selection.name);
    if (!["PASS", "FAIL", "INCOMPLETE", "NOT_RUN"].includes(selection.status)) refusal("test status");
    if (selection.status !== "PASS") continue;
    if (!selection.command || !sha(selection.commitSha) || selection.commitSha !== manifest.source.commitSha ||
        !["offline", "sandbox", "approved-live"].includes(selection.providerMode)) refusal("test scope");
    if (![selection.expected, selection.passed, selection.failed, selection.skipped, selection.flaky].every(count) ||
        selection.expected < 1 || selection.passed !== selection.expected || selection.failed !== 0 || selection.skipped !== 0 || selection.flaky !== 0) refusal("test accounting");
    if (!root || typeof selection.artifact !== "string" || path.isAbsolute(selection.artifact) || selection.artifact.includes("\\") ||
        selection.artifact.split("/").some(segment => ["", ".", ".."].includes(segment)) || !digest(selection.artifactSha256)) refusal("artifact path/digest");
    const rootPath = realpathSync(root);
    let artifactPath, bytes;
    try { artifactPath = realpathSync(path.resolve(rootPath, selection.artifact)); bytes = readFileSync(artifactPath); } catch { refusal("missing artifact"); }
    if (!artifactPath.startsWith(`${rootPath}${path.sep}`)) refusal("artifact escapes repository");
    if (createHash("sha256").update(bytes).digest("hex") !== selection.artifactSha256) refusal("artifact hash");
    let receipt;
    try { receipt = JSON.parse(bytes); } catch { refusal("artifact JSON"); }
    if (receipt.commitSha !== selection.commitSha || receipt.sourceTreeSha !== manifest.source.treeSha || receipt.status !== "PASS" ||
        receipt.testsPassed !== selection.passed || receipt.testsFailed !== 0 || receipt.testsSkipped !== 0 || receipt.testsFlaky !== 0 ||
        receipt.process?.exitCode !== 0) refusal("artifact source/result mismatch");
    if (selection.runUrl && !/^https:\/\/github\.com\/analyticsmath\/KT-Courier\/actions\/runs\/\d+(?:\/job\/\d+)?$/.test(selection.runUrl)) refusal("run URL");
  }
  if (manifest.classification === "ENGINEERING_COMPLETE") {
    if (!expectedSha || manifest.source.commitSha !== expectedSha || mandatorySelections.some(name => !manifest.tests.some(row => row.name === name && row.status === "PASS"))) refusal("complete engineering requires exact-current mandatory proof");
  }
  if (manifest.releaseDecision === "GO") {
    if (manifest.classification !== "ENGINEERING_COMPLETE" || manifest.blockers.length || manifest.gates.some(gate => gate.status !== "IMPLEMENTED" || !gate.operatorApproval)) refusal("GO authority");
  }
  return { valid: true, classification: manifest.classification, releaseDecision: manifest.releaseDecision, passingSelections: manifest.tests.filter(row => row.status === "PASS").length };
}
