import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exactCertificationSourceMatches } from "./check-closure-engineering-gates.mjs";

export function informationalReleaseStatus(sourceSha, expectedSha) {
  if (!exactCertificationSourceMatches(sourceSha, expectedSha)) throw new Error("Exact source SHA is required for engineering status.");
  return { schemaVersion: 1, sourceSha, releaseStatus: "RELEASE_NOT_AUTHORIZED", launchAuthorized: false, approvalEvaluated: false };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 5000 }).trim();
    const receipt = informationalReleaseStatus(sourceSha, process.env.KT_CERTIFICATION_HEAD_SHA);
    mkdirSync("output/production-closure", { recursive: true });
    writeFileSync("output/production-closure/release-status.json", `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(`${receipt.releaseStatus}: independent production approval was not evaluated.`);
  } catch (error) { console.error(error instanceof Error ? error.message : "Status generation failed."); process.exitCode = 1; }
}
