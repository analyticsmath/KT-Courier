import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { evaluateLaunchGateManifest, exactCertificationSourceMatches } from "./check-closure-engineering-gates.mjs";
const REGISTRY = "docs/production-closure/engineering-gates.json";
const RECEIPT = "output/production-closure/phase3-blocker-actions.json";
/** Diagnostic worklist, never source-only launch approval. */
export const PHASE3_REMEDIATION = Object.freeze({
  "marketplace_parcel_classification": {
    "accountable": "Store owners / courier and product operations",
    "kind": "OPERATING_DATA_AND_PHYSICAL_ACCEPTANCE",
    "actions": [
      "Collect genuine measured merchant package facts and approve multi-item packing rules.",
      "Verify quote tariff, assigned vehicle capacity, pickup, OTP and physical delivery; unsupported aggregated packages remain blocked."
    ],
    "evidence": "Approved packaging profiles, multi-item acceptance, original quote/order/assignment references."
  },
  "notification_required_domains": {
    "accountable": "Business owner / notification administrator",
    "kind": "OPERATOR_APPROVAL_AND_PROVIDER_ACCEPTANCE",
    "actions": [
      "Independently approve and publish templates, active recipients and event routes.",
      "Verify authorized sender domain, email/SMS delivery and payment/dispatch/OTP alerts against real recipient evidence."
    ],
    "evidence": "Reviewed template and routing versions, redacted delivery receipts."
  },
  "commercial_financial_certification": {
    "accountable": "Business owner / independent finance reviewer / tax adviser",
    "kind": "INDEPENDENT_FINANCIAL_AUTHORIZATION",
    "actions": [
      "Approve effective commissions, tax, COD, cash limits, merchant/store order policy, bank and settlement scopes.",
      "Authorize bounded Paystack Test Mode and independent maker/checker; do not bypass live money, refund or payout locks."
    ],
    "evidence": "Approved policy versions, provider/bank proof and independent finance authorization."
  },
  "customer_vendor_driver_full_functional_acceptance": {
    "accountable": "Product owner / approved merchant, driver and operator",
    "kind": "REAL_ACCOUNT_AND_PHYSICAL_ACCEPTANCE",
    "actions": [
      "Create genuine owner-controlled customer, store and driver accounts; certify actual store pickup and driver/vehicle eligibility.",
      "Observe quote, payment, dispatch, sender OTP, tracking, recipient OTP, proof, customer review and financial closeout."
    ],
    "evidence": "Redacted authenticated role/order/driver/finance acceptance references and physical custody proof."
  },
  "visual_acceptance": {
    "accountable": "Product owner / independent accessibility reviewer",
    "kind": "HUMAN_UX_AND_ACCESSIBILITY_ACCEPTANCE",
    "actions": [
      "Inspect current deployments at 320/390/1440 px for customer, vendor, driver and admin.",
      "Run keyboard, focus, zoom and screen-reader exercises; fix reproduced defects and record human acceptance."
    ],
    "evidence": "Signed current-SHA UI/accessibility evidence and device observations."
  },
  "media_full_functional_acceptance": {
    "accountable": "Media provider administrator / driver / product owner",
    "kind": "PROVIDER_DEVICE_AND_CUSTODY_ACCEPTANCE",
    "actions": [
      "Verify actual private Cloudinary storage, document access denial and safe upload retry.",
      "Test real camera and GPS permissions, document replacements and physical POD."
    ],
    "evidence": "Restricted storage IDs, real-device and POD observations; no private image contents in reports."
  },
  "critical_skip_closure": {
    "accountable": "Engineering lead / product owner",
    "kind": "ENGINEERING_SCOPE_DECISION",
    "actions": [
      "Reconcile skip/deferred inventory against active release functionality and mandatory exact-source tests.",
      "Implement required disabled capabilities only where approved; explicitly sign off excluded optional processor scopes rather than marking them passed."
    ],
    "evidence": "Mandatory suite results with zero critical skips and approved scope/exclusion register."
  },
  "fresh_production_protected_row_audit": {
    "accountable": "Authorized DBA / independent security reviewer",
    "kind": "LEAST_PRIVILEGE_PRODUCTION_AUDIT",
    "actions": [
      "Obtain approved least-privilege read-only PostgreSQL principal, not postgres/superuser.",
      "Repeat and compare protected-table row counts/hashes with transaction_read_only enabled; do not export PII."
    ],
    "evidence": "Read-only principal privileges, SHA-bound protected baseline and independent reconciliation."
  },
  "github_certification_and_deployment": {
    "accountable": "Release engineer / operations owner",
    "kind": "EXACT_SHA_DEPLOYMENT_AND_WORKER_ACCEPTANCE",
    "actions": [
      "Match CI, 25 automated certification jobs, Vercel and Railway to exact source SHA.",
      "Inspect worker queues, StoreOrderOperationalPolicy retries, notification routes and registered disabled processors; obtain operator acceptance."
    ],
    "evidence": "Exact workflow/deployment references, worker capability evidence and operator approval."
  }
});
export function buildPhase3BlockerReport(manifest, {sourceSha = null, expectedSha = null} = {}) {
  const verdict = evaluateLaunchGateManifest(manifest);
  return Object.freeze({
    schemaVersion: 1, sourceSha, expectedSha,
    sourceMatches: exactCertificationSourceMatches(sourceSha, expectedSha),
    launchAuthorization: "NOT_EVALUATED",
    automatedEngineeringCertification: "NOT_EVALUATED",
    classification: verdict.classification,
    totalGates: verdict.total, unresolvedCount: verdict.unresolved.length,
    gateActions: verdict.unresolved.map(({key,status}) => {
      const policy = PHASE3_REMEDIATION[key];
      return {
        key, status,
        accountable: policy?.accountable ?? "Release owner / responsible domain owner",
        kind: policy?.kind ?? "UNCATEGORIZED_REQUIRES_INDEPENDENT_REVIEW",
        actions: policy?.actions ?? ["Classify this independent gate, obtain genuine acceptance, and retain NOT_READY."],
        evidenceRequired: policy?.evidence ?? "Authentic, scope-bound independent approval and acceptance."
      };
    }),
    note: "Operational worklist only. Neither this script nor zero reported blockers authorizes real money or launch."
  });
}
function currentSha() {
  try { return execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8",timeout:5000}).trim(); }
  catch { return null; }
}
export function writePhase3BlockerReport(env=process.env) {
  const report=buildPhase3BlockerReport(JSON.parse(readFileSync(REGISTRY,"utf8")), {
    sourceSha:currentSha(), expectedSha:env.KT_CERTIFICATION_HEAD_SHA ?? null
  });
  mkdirSync("output/production-closure",{recursive:true});
  writeFileSync(RECEIPT,JSON.stringify(report,null,2)+"\n");
  console.log("PHASE3_BLOCKER_ACTIONS="+RECEIPT+" unresolved="+report.unresolvedCount+" sourceMatches="+report.sourceMatches);
  for(const gate of report.gateActions) console.log("["+gate.status+"] "+gate.key+" -> "+gate.accountable);
  console.log("Report is diagnostic. The independent Phase 3 live-launch veto is unchanged.");
  return report;
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { writePhase3BlockerReport(); }
  catch(error) { console.error(error instanceof Error?error.message:String(error));process.exitCode=1; }
}
