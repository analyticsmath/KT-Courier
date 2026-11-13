import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateLaunchGateManifest } from "./check-closure-engineering-gates.mjs";

// Only non-secret actions are emitted. Historical registry evidence may contain
// stale claims, so it is never copied into this current diagnostic receipt.
const ACTIONS = Object.freeze({
  marketplace_parcel_classification: ["Store owners and courier operations", "Measured packages, approved multi-item rules and delivered-route references", "Supply measured package facts and independently review classification, carrier capacity and delivery."],
  notification_required_domains: ["Owner and notification administrator", "Approved template versions, routes and recipient-delivery receipts", "Review templates, sender and recipient routes, then exercise authorized notification delivery."],
  commercial_financial_certification: ["Owner, independent finance reviewer and accountant", "Versioned approvals, test-mode authorization and source-bound provider or bank evidence", "Approve applicable finance, tax, COD, settlement, refund and payout scope before any live financial action."],
  customer_vendor_driver_full_functional_acceptance: ["Product owner, store, driver and administrator", "Authorized role-based chronological journey evidence", "Create real-email test accounts and execute the approved parcel and marketplace journeys."],
  visual_acceptance: ["Product owner and accessibility reviewer", "Current-SHA device, keyboard and assistive-technology acceptance", "Review all role journeys at agreed viewport sizes and retest any defects."],
  media_full_functional_acceptance: ["Authorized media operator and role participants", "Restricted storage references, provider permissions and genuine device or delivery evidence", "Verify private media controls and authorized camera, location, upload and proof-of-delivery journeys."],
  critical_skip_closure: ["Engineering lead and product owner", "Machine-checked mandatory selections and independently approved optional-scope disposition", "Audit deferred tests and disabled processors; prove required selections and document scope decisions."],
  fresh_production_protected_row_audit: ["Authorized database administrator and independent reviewer", "Least-privilege principal proof and SHA-bound protected-table count/hash comparison", "Provision an approved read-only path and compare the protected baseline without exporting row contents."],
  github_certification_and_deployment: ["Release owner and independent operator", "Exact-SHA engineering receipts, deployment references and worker/queue review", "Verify source parity, settled deployments, relevant policies and operational queues independently."],
});

export function buildBlockerActions(manifest, sourceSha) {
  if (typeof sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("A complete source commit SHA is required.");
  const verdict = evaluateLaunchGateManifest(manifest);
  const actions = verdict.unresolved.map(({ key, status }) => {
    const action = ACTIONS[key];
    if (!action) throw new Error(`No reviewed operator action exists for unresolved gate: ${key}`);
    const [owner, evidenceRequired, nextAction] = action;
    return { key, status, owner, evidenceRequired, nextAction };
  });
  return { schemaVersion: 1, sourceSha, generatedAt: new Date().toISOString(), classification: verdict.classification, launchAuthorized: false, purpose: "DIAGNOSTIC_ONLY", actions };
}

export function main() {
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 5000 }).trim();
  const workingTreeClean = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8", timeout: 5000 }).trim().length === 0;
  const manifest = JSON.parse(readFileSync("docs/production-closure/engineering-gates.json", "utf8"));
  const report = { ...buildBlockerActions(manifest, sourceSha), workingTreeClean };
  const target = "output/production-closure/phase3-blocker-actions.json";
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PHASE3_BLOCKER_ACTIONS=${target} SOURCE_SHA=${sourceSha} OPEN=${report.actions.length} LAUNCH_AUTHORIZED=false`);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : "Diagnostic failed."); process.exitCode = 1; }
}
