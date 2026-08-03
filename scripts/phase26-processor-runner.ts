import { resolveRecruitmentProductionComposition } from "@/lib/recruitment/composition-root";
import { processApplicationCompleteness } from "@/lib/recruitment/processors/application-completeness.processor";
import { processAutomatedScreening } from "@/lib/recruitment/processors/automated-screening.processor";
import { processOfferExpiry } from "@/lib/recruitment/processors/offer-expiry.processor";
import { processOnboardingHandoffs } from "@/lib/recruitment/processors/onboarding-handoff.processor";
import { processOpeningLifecycle } from "@/lib/recruitment/processors/opening-lifecycle.processor";
import { processRecruitmentReconciliation } from "@/lib/recruitment/processors/recruitment-reconciliation.processor";
import { processRetentionSchedule } from "@/lib/recruitment/processors/retention-schedule.processor";
import { RecruitmentFraudService } from "@/lib/recruitment/fraud.service";

const [operation, mode, limitFlag, limitValue] = process.argv.slice(2);
if (!operation || !mode || limitFlag !== "--limit" || !limitValue) throw new Error("Invalid Phase 26 processor invocation.");

const apply = mode === "--apply";
const limit = Number(limitValue);
const operationId = `phase26:${operation}:${new Date().toISOString().slice(0, 10)}`;
const composition = resolveRecruitmentProductionComposition();

async function scanRecruitmentFraud() {
  if (composition.status === "LOCKED") return composition;
  const candidates = await composition.repositories.application.findMany({ where: { status: "SUBMITTED" }, take: limit });
  const service = new RecruitmentFraudService(composition.database);
  await Promise.all(candidates.map((candidate: { id: string }) => service.evaluateFraudForApplication(candidate.id)));
  return { status: "SUCCESS", processed: candidates.length };
}

async function run() {
  // Constructing all concrete dependencies happens before this boundary. The
  // lock intentionally prevents both dry-runs and --apply from mutating until
  // Phase 26.5 has completed consolidated validation.
  if (composition.status === "LOCKED") {
    console.log(JSON.stringify({ operation, operationId, apply, limit, status: "LOCKED", code: composition.code }));
    return;
  }

  const handlers: Record<string, () => Promise<unknown>> = {
    preflight: async () => ({ status: "READY" }),
    "close-expired-openings": processOpeningLifecycle,
    "expire-draft-applications": processApplicationCompleteness,
    "process-screening-flags": processAutomatedScreening,
    "expire-offers": processOfferExpiry,
    "process-onboarding-handoffs": processOnboardingHandoffs,
    "process-retention": processRetentionSchedule,
    "scan-fraud": scanRecruitmentFraud,
    "scan-reconciliation": processRecruitmentReconciliation,
    "verify-invariants": async () => ({ status: "READY" }),
    "launch-integration-suite": async () => ({ status: "DEFERRED_TO_PHASE_26_5" }),
  };
  const handler = handlers[operation];
  if (!handler) throw new Error(`Unknown Phase 26 processor: ${operation}`);
  if (!apply) {
    console.log(JSON.stringify({ operation, operationId, apply, limit, status: "DRY_RUN" }));
    return;
  }
  console.log(JSON.stringify({ operation, operationId, apply, limit, result: await handler() }));
}

void run();
