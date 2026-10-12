import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { validatePhase3Evidence } from "./phase3-evidence.mjs";

try {
  const manifest = JSON.parse(readFileSync("docs/phase3/final-certification.json", "utf8"));
  const gates = JSON.parse(readFileSync("docs/production-closure/engineering-gates.json", "utf8")).gates;
  const expectedSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const actualTree = execFileSync("git", ["rev-parse", `${manifest.source.commitSha}^{tree}`], { encoding: "utf8" }).trim();
  if (actualTree !== manifest.source.treeSha) throw new Error("PHASE3_EVIDENCE_INVALID: recorded source tree");
  console.log(JSON.stringify(validatePhase3Evidence(manifest, { root: process.cwd(), expectedSha, launchGates: gates })));
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("PHASE3_EVIDENCE_INVALID:") ? error.message : "PHASE3_EVIDENCE_INVALID: unreadable manifest or source");
  process.exitCode = 1;
}
