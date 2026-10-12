import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { validatePhase3Evidence } from "./phase3-evidence.mjs";
import { validateFinalClosureEvidence } from "./final-closure-evidence.mjs";

try {
  const manifest = JSON.parse(readFileSync("docs/phase3/final-certification.json", "utf8"));
  const gates = JSON.parse(readFileSync("docs/production-closure/engineering-gates.json", "utf8")).gates;
  const expectedSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const actualTree = execFileSync("git", ["rev-parse", `${manifest.source.commitSha}^{tree}`], { encoding: "utf8" }).trim();
  if (actualTree !== manifest.source.treeSha) throw new Error("PHASE3_EVIDENCE_INVALID: recorded source tree");
  console.log(JSON.stringify(validatePhase3Evidence(manifest, { root: process.cwd(), expectedSha, launchGates: gates })));
  if (existsSync("docs/final-closure/final-acceptance.json")) {
    const final = JSON.parse(readFileSync("docs/final-closure/final-acceptance.json", "utf8"));
    for (const source of [final.source, ...final.tests.map(test => ({ commitSha: test.commitSha, treeSha: test.sourceTreeSha }))]) {
      const tree = execFileSync("git", ["rev-parse", `${source.commitSha}^{tree}`], { encoding: "utf8" }).trim();
      if (tree !== source.treeSha) throw new Error("FINAL_CLOSURE_EVIDENCE_INVALID: recorded tree");
      execFileSync("git", ["merge-base", "--is-ancestor", source.commitSha, expectedSha]);
    }
    console.log(JSON.stringify(validateFinalClosureEvidence(final, { root: process.cwd(), expectedSha, launchGates: gates })));
  }
} catch (error) {
  console.error(error instanceof Error && /^(PHASE3|FINAL_CLOSURE)_EVIDENCE_INVALID:/.test(error.message) ? error.message : "PHASE3_EVIDENCE_INVALID: unreadable manifest or source");
  process.exitCode = 1;
}
