import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REGISTRY_PATH = "docs/production-closure/engineering-gates.json";
const RECEIPT_PATH = "output/production-closure/phase3-launch-veto.json";

/**
 * A passing browser/CI suite is NOT equivalent to authorization to charge
 * customers or run production migrations. This independent gate must reject
 * absent/duplicate/malformed rows and anything short of verified READY.
 */
export function evaluateLaunchGateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.gates)
    || !["READY", "NOT_READY"].includes(manifest.classification)
    || manifest.gates.length === 0) {
    throw new Error("Invalid or missing production launch gate registry.");
  }
  const keys = new Set();
  const unresolved = [];
  for (const gate of manifest.gates) {
    if (!gate || typeof gate.key !== "string" || !/^[a-z][a-z0-9_]*$/.test(gate.key)
      || keys.has(gate.key)
      || !["IMPLEMENTED", "OPEN", "VALIDATION_BLOCKED"].includes(gate.status)
      || typeof gate.evidence !== "string" || gate.evidence.trim().length === 0) {
      throw new Error("Invalid, duplicate or evidence-free production launch gate.");
    }
    keys.add(gate.key);
    if (gate.status !== "IMPLEMENTED") unresolved.push({
      key: gate.key, status: gate.status, evidence: gate.evidence,
    });
  }
  return Object.freeze({
    classification: manifest.classification,
    ready: manifest.classification === "READY" && unresolved.length === 0,
    total: manifest.gates.length,
    implemented: manifest.gates.length - unresolved.length,
    unresolved,
  });
}

function currentSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

export function exactSourceMatches(sourceSha, expectedSha) {
  return typeof sourceSha === "string" && typeof expectedSha === "string" &&
    /^[a-f0-9]{40}$/.test(sourceSha) && /^[a-f0-9]{40}$/.test(expectedSha) && sourceSha === expectedSha;
}

/** A source registry is not independent operator or finance authorization. */
export function authorizeFromSourceRegistry(_verdict, _sourceSha, _expectedSha) {
  return false;
}

export function runPhase3GateCheck() {
  const sourceSha = currentSha();
  const expectedSha = process.env.KT_CERTIFICATION_HEAD_SHA ?? null;
  let verdict;
  try {
    verdict = evaluateLaunchGateManifest(JSON.parse(readFileSync(REGISTRY_PATH, "utf8")));
  } catch (error) {
    console.error("NOT_READY: invalid launch registry; refusing production authorization.", error);
    process.exitCode = 1;
    return;
  }
  const shaMatches = exactSourceMatches(sourceSha, expectedSha);
  const ready = authorizeFromSourceRegistry(verdict, sourceSha, expectedSha);
  const receipt = {
    schemaVersion: 1,
    sourceSha,
    expectedSha,
    sourceMatches: shaMatches,
    classification: verdict.classification,
    launchAuthorized: ready,
    gateCounts: {
      total: verdict.total,
      implemented: verdict.implemented,
      unresolved: verdict.unresolved.length,
    },
    unresolved: verdict.unresolved,
    evidenceTier: "SOURCE_REGISTRY_ONLY",
    note: "This receipt is a refusal or local registry check, never an independent production/finance approval.",
  };
  mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`PHASE3_LAUNCH_RECEIPT=${RECEIPT_PATH} SOURCE_SHA=${sourceSha ?? "UNKNOWN"} AUTHORIZED=${ready}`);
  if (!ready) {
    console.error(`NOT_READY: ${verdict.unresolved.length} unresolved of ${verdict.total} production launch gates; classification=${verdict.classification}; sourceMatches=${shaMatches}`);
    for (const gate of verdict.unresolved) {
      console.error(`  [${gate.status}] ${gate.key}: ${gate.evidence.replace(/\s+/g, " ").slice(0, 300)}`);
    }
    if (!shaMatches) console.error("  [SOURCE_MISMATCH] Certification checkout is not the expected exact SHA.");
    if (verdict.ready && shaMatches) console.error("  [INDEPENDENT_APPROVAL_REQUIRED] Source registry evidence alone cannot authorize production launch.");
    process.exitCode = 1;
    return;
  }
  console.log("All registry gates are IMPLEMENTED and classification is READY. Independent finance, operator, deployment, and protected-row evidence still must be audited.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runPhase3GateCheck();
}
