import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync("docs/production-closure/engineering-gates.json", "utf8"));
const blocked = manifest.gates.filter((gate) => gate.status !== "IMPLEMENTED");
if (blocked.length) {
  console.error(`NOT_READY: unresolved engineering gates: ${blocked.map((gate) => gate.key).join(", ")}`);
  process.exitCode = 1;
} else console.log("All engineering-controlled gates are implemented; check required workflow jobs and production evidence separately.");
