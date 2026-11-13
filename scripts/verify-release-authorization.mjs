import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exactCertificationSourceMatches } from "./check-closure-engineering-gates.mjs";

/** This protected entrypoint cannot authorize until independent services exist. */
export function classifyReleaseAttempt({ releaseSha, workflowSha, sourceSha, evidenceReference }) {
  let reason = "INDEPENDENT_AUTHORITY_UNAVAILABLE";
  if (!exactCertificationSourceMatches(sourceSha, workflowSha) || !exactCertificationSourceMatches(sourceSha, releaseSha)) reason = "SOURCE_MISMATCH";
  else if (typeof evidenceReference !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(evidenceReference)) reason = "INVALID_EVIDENCE_REFERENCE";
  return { schemaVersion: 1, releaseAuthorized: false, status: "RELEASE_NOT_AUTHORIZED", reason,
    sourceSha: typeof sourceSha === "string" && /^[a-f0-9]{40}$/.test(sourceSha) ? sourceSha : null,
    evidenceReferenceDigest: typeof evidenceReference === "string" && evidenceReference.length <= 200 ? createHash("sha256").update(evidenceReference).digest("hex") : null };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let sourceSha = null;
  try { sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 5000 }).trim(); } catch { /* refusal below */ }
  const result = classifyReleaseAttempt({ sourceSha, releaseSha: process.env.RELEASE_SHA, workflowSha: process.env.WORKFLOW_SHA, evidenceReference: process.env.EVIDENCE_REFERENCE });
  mkdirSync("output/production-closure", { recursive: true });
  writeFileSync("output/production-closure/release-authorization-refusal.json", `${JSON.stringify(result, null, 2)}\n`);
  console.error(`${result.status}: ${result.reason}. Independent trust, evidence and replay-protection services are required.`);
  process.exitCode = 1;
}
