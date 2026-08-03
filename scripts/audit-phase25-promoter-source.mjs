import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const root = process.cwd(); const targets = ["lib/promoters", "app/api/promoter", "app/api/admin", "app/api/referrals", "app/(account)/promoter", "app/(admin)/admin", "scripts"];
const prohibited = [/\bTODO\b/i, /\bFIXME\b/i, /\bplaceholder\b/i, /\bscaffold\b/i, /throw new Error\(["']Not implemented["']\)/i, /return \[\]/];
function files(path) { return readdirSync(path, { withFileTypes: true }).flatMap((entry) => { const resolved = join(path, entry.name); return entry.isDirectory() ? files(resolved) : /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [resolved] : []; }); }
const failures = [];
for (const target of targets) { const directory = join(root, target); if (!statSync(directory).isDirectory()) continue; for (const file of files(directory)) { const relativePath = relative(root, file); if ((target === "app/(admin)/admin" || target === "scripts") && !/promoter/i.test(relativePath)) continue; const content = readFileSync(file, "utf8"); for (const pattern of prohibited) if (pattern.test(content) && !file.endsWith("audit-phase25-promoter-source.mjs")) failures.push(`${relativePath} matches ${pattern}`); } }
if (failures.length) throw new Error(`Phase 25 promoter source audit failed:\n${failures.join("\n")}`);
const requiredRoutes = [
  "app/api/admin/promoter-programs/route.ts", "app/api/admin/promoter-programs/[reference]/route.ts", "app/api/admin/promoter-programs/[reference]/submit/route.ts", "app/api/admin/promoter-programs/[reference]/approve/route.ts", "app/api/admin/promoter-programs/[reference]/reject/route.ts", "app/api/admin/promoter-programs/[reference]/activate/route.ts", "app/api/admin/promoter-programs/[reference]/pause/route.ts", "app/api/admin/promoter-programs/[reference]/end/route.ts",
  "app/api/admin/promoters/route.ts", "app/api/admin/promoters/[reference]/route.ts", "app/api/admin/promoters/[reference]/approve/route.ts", "app/api/admin/promoters/[reference]/request-changes/route.ts", "app/api/admin/promoters/[reference]/activate/route.ts", "app/api/admin/promoters/[reference]/suspend/route.ts", "app/api/admin/promoters/[reference]/terminate/route.ts",
  "app/api/admin/promoter-agreements/route.ts", "app/api/admin/promoter-agreements/[reference]/route.ts", "app/api/admin/promoter-assets/route.ts", "app/api/admin/promoter-assets/[reference]/route.ts",
];
for (const file of requiredRoutes) if (!statSync(join(root, file), { throwIfNoEntry: false })) failures.push(`missing required Phase 25 route: ${file}`);
for (const name of ["phase25-promoter-preflight.mjs", "expire-promoter-attributions.mjs", "process-promoter-qualifications.mjs", "release-promoter-earnings.mjs", "process-promoter-reversals.mjs", "scan-promoter-fraud.mjs", "scan-promoter-reconciliation.mjs", "verify-promoter-invariants.mjs", "promoter-integration-test.mjs"]) {
  const content = readFileSync(join(root, "scripts", name), "utf8");
  if (!content.includes("runPromoterProcessor") || /selectCandidates:\s*async\s*\([^)]*\)\s*=>\s*\[\]/.test(content)) failures.push(`processor lacks bounded canonical work: ${name}`);
}
for (const file of files(join(root, "app/api/admin"))) {
  const content = readFileSync(file, "utf8");
  if (/\b(?:forceResolve|markResolved|manualAdjustment|manualConvergence)\b/.test(content)) failures.push(`forbidden manual reconciliation operation in ${relative(root, file)}`);
}
if (failures.length) throw new Error(`Phase 25 promoter source audit failed:\n${failures.join("\n")}`);
console.log("Phase 25 promoter source audit passed.");
