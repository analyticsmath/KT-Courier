import { verifyEnvironmentSchema } from "../lib/runtime/env-schema-verifier.ts";

const report = verifyEnvironmentSchema(process.env);
console.log(JSON.stringify(report, null, 2));
if (!report.valid) {
  process.exitCode = 1;
}
