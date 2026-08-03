import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const runner = path.join(root, "scripts", "phase26-processor-runner.ts");

export const PHASE26_PROCESSORS = Object.freeze({
  preflight: { handler: "verifyPhase26Preflight", repository: "composition root", service: "production readiness" },
  "close-expired-openings": { handler: "processOpeningLifecycle", repository: "openingVersion", service: "OpeningService" },
  "expire-draft-applications": { handler: "processApplicationCompleteness", repository: "application", service: "ApplicationService" },
  "process-screening-flags": { handler: "processAutomatedScreening", repository: "application", service: "ScreeningService" },
  "expire-offers": { handler: "processOfferExpiry", repository: "offerVersion", service: "OfferService" },
  "process-onboarding-handoffs": { handler: "processOnboardingHandoffs", repository: "handoff", service: "OnboardingHandoffService" },
  "process-retention": { handler: "processRetentionSchedule", repository: "application", service: "PrivacyRetentionService" },
  "scan-fraud": { handler: "scanRecruitmentFraud", repository: "application", service: "RecruitmentFraudService" },
  "scan-reconciliation": { handler: "processRecruitmentReconciliation", repository: "reconciliationCase", service: "RecruitmentReconciliationService" },
  "verify-invariants": { handler: "verifyRecruitmentInvariants", repository: "composition root", service: "production readiness" },
  "launch-integration-suite": { handler: "launchDisposableIntegrationValidation", repository: "none", service: "Phase 26.5 deferred validation gate" },
});

function parseOptions(argv) {
  let apply = false;
  let limit = 100;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") apply = true;
    else if (argument === "--dry-run") apply = false;
    else if (argument === "--limit") {
      const raw = argv[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1000) {
        throw new Error("--limit must be an integer between 1 and 1000.");
      }
      limit = Number(raw);
    } else {
      throw new Error(`Unsupported Phase 26 processor option: ${argument}`);
    }
  }
  return { apply, limit };
}

export function runPhase26Processor(operation, argv = process.argv.slice(2)) {
  if (!PHASE26_PROCESSORS[operation]) throw new Error(`Unknown Phase 26 processor: ${operation}`);
  const options = parseOptions(argv);
  const result = spawnSync(process.execPath, [tsxCli, runner, operation, options.apply ? "--apply" : "--dry-run", "--limit", String(options.limit)], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}
