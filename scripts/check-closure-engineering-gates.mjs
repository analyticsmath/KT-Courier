import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync("docs/production-closure/engineering-gates.json", "utf8"));
const blocked = manifest.gates.filter((gate) => gate.status !== "IMPLEMENTED");
if (blocked.length) {
  console.error(`NOT_READY: unresolved launch register gates (engineering, verification and external approvals): ${blocked.map((gate) => gate.key).join(", ")}`);
  process.exitCode = 1;
} else console.log("All registered gates are marked implemented; this is not independent certification. Check exact-source workflow receipts and production evidence separately.");
