import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { hasTestDeferrals, isInactiveRecruitmentTest } from "./release-test-deferrals.mjs";
const recruitmentReadiness = readFileSync("lib/recruitment/production-readiness.ts", "utf8");
const files = [];
function walk(directory) { for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = `${directory}/${entry.name}`; if (entry.isDirectory()) walk(path); else if (/\.(?:ts|tsx|mjs)$/.test(path)) files.push(path); } }
walk("tests");
const rows = [];
for (const file of files.sort()) {
  const source = readFileSync(file, "utf8");
  if (!hasTestDeferrals(source, file)) continue;
  const legacy = /payfast/.test(file);
  const recruitment = /^tests\/phase26\/(?:e2e|integration)\//.test(file);
  const inactiveRecruitment = isInactiveRecruitmentTest(file, recruitmentReadiness);
  const optional = recruitment ? inactiveRecruitment : /(?:promoter|subscription|advertising|developer|recruitment|screening|hiring|talent|retention|home-cinematic)/.test(file);
  const conditional = /skipIf|describeReal|describeCatalogIntegration|isLocalValidationServerAvailable|\[SKIP_DB_EXECUTION\]/.test(source);
  rows.push({ file, classification: legacy ? "LEGACY_COMPATIBILITY" : optional ? "DEFERRED_OPTIONAL_INACTIVE" : "RELEASE_CRITICAL", status: legacy || optional ? "EXCLUDED_WITH_SCOPE" : conditional ? "MUST_EXECUTE_WITH_DISPOSABLE_FLAGS" : "OPEN_ENGINEERING", reason: legacy ? "PayFast compatibility is outside current Paystack launch authority." : inactiveRecruitment ? "Optional Phase 26 recruitment remains source-locked false; see OPTIONAL_RECRUITMENT_EXCLUSION.md. Excluded, not passed. Canonical driver/staff launch tests remain required." : optional ? "Inactive optional commercial/developer/recruitment policy or cinematic visual regression; not proof of an active flow." : conditional ? "Safety guard must be enabled only in disposable infrastructure; certification rejects actual skips/early-return markers." : "Active launch capability still contains a placeholder; must be replaced with executable functional assertions." });
}
const text = ["# Test deferral audit", "", "Generated from the current test tree. This inventory does not make an exclusion or placeholder a pass. Optional features stay inactive until independently certified. The production certification wrapper rejects non-zero skipped/todo/pending/flaky counts and safety early-return markers.", "", "| File | Classification | Status | Reason |", "|---|---|---|---|", ...rows.map((r) => `| ${r.file} | ${r.classification} | ${r.status} | ${r.reason} |`), "", `Audited files with skip/deferral markers: ${rows.length}. Release-critical open placeholders: ${rows.filter((r) => r.status === "OPEN_ENGINEERING").length}.`, ""];
writeFileSync("docs/production-closure/TEST_DEFERRALS.md", text.join("\n"));
console.log(JSON.stringify({ files: rows.length, openCriticalPlaceholders: rows.filter((r) => r.status === "OPEN_ENGINEERING").length }));
