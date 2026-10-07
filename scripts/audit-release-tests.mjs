import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
const files = [];
function walk(directory) { for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = `${directory}/${entry.name}`; if (entry.isDirectory()) walk(path); else if (/\.(?:ts|tsx|mjs)$/.test(path)) files.push(path); } }
walk("tests");
const rows = [];
for (const file of files.sort()) {
  const source = readFileSync(file, "utf8");
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let hasSkip = false;
  function inspect(node) {
    if (ts.isPropertyAccessExpression(node) && /^(?:describe|test|it)$/.test(node.expression.getText(parsed)) && /^(?:skip|skipIf|todo|fixme)$/.test(node.name.text)) hasSkip = true;
    if (ts.isIfStatement(node) && /safety\.ok/.test(node.expression.getText(parsed)) && /\breturn\b/.test(node.thenStatement.getText(parsed))) hasSkip = true;
    ts.forEachChild(node, inspect);
  }
  inspect(parsed); if (!hasSkip) continue;
  const legacy = /payfast/.test(file);
  const optional = /(?:promoter|subscription|advertising|developer|recruitment|screening|hiring|talent|retention|home-cinematic)/.test(file);
  const conditional = /skipIf|describeReal|describeCatalogIntegration|isLocalValidationServerAvailable|\[SKIP_DB_EXECUTION\]/.test(source);
  rows.push({ file, classification: legacy ? "LEGACY_COMPATIBILITY" : optional ? "DEFERRED_OPTIONAL_INACTIVE" : "RELEASE_CRITICAL", status: legacy || optional ? "EXCLUDED_WITH_SCOPE" : conditional ? "MUST_EXECUTE_WITH_DISPOSABLE_FLAGS" : "OPEN_ENGINEERING", reason: legacy ? "PayFast compatibility is outside current Paystack launch authority." : optional ? "Inactive optional commercial/developer/recruitment policy or cinematic visual regression; not proof of an active flow." : conditional ? "Safety guard must be enabled only in disposable infrastructure; certification rejects actual skips/early-return markers." : "Active launch capability still contains a placeholder; must be replaced with executable functional assertions." });
}
const text = ["# Test deferral audit", "", "Generated from the current test tree. This inventory does not make an exclusion or placeholder a pass. Optional features stay inactive until independently certified. The production certification wrapper rejects non-zero skipped/todo/pending counts and safety early-return markers.", "", "| File | Classification | Status | Reason |", "|---|---|---|---|", ...rows.map((r) => `| ${r.file} | ${r.classification} | ${r.status} | ${r.reason} |`), "", `Audited files with skip/deferral markers: ${rows.length}. Release-critical open placeholders: ${rows.filter((r) => r.status === "OPEN_ENGINEERING").length}.`, ""];
writeFileSync("docs/production-closure/TEST_DEFERRALS.md", text.join("\n"));
console.log(JSON.stringify({ files: rows.length, openCriticalPlaceholders: rows.filter((r) => r.status === "OPEN_ENGINEERING").length }));
