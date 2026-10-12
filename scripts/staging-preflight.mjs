import { readFileSync } from "node:fs";
import { assertStagingIsolation } from "./staging-isolation.mjs";

try {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) throw new Error("Supply an operator-reviewed resource policy JSON path; no implicit environment file is loaded.");
  const receipt = assertStagingIsolation(process.env, JSON.parse(readFileSync(file, "utf8")));
  console.log(JSON.stringify({ ...receipt, checkedAtUtc: new Date().toISOString() }, null, 2));
} catch (error) {
  // Validation errors contain field names only. JSON parse failures may contain secrets.
  console.error(error instanceof SyntaxError ? "STAGING_ISOLATION_REFUSED: malformed policy JSON" : error instanceof Error ? error.message : "STAGING_ISOLATION_REFUSED");
  process.exitCode = 1;
}
