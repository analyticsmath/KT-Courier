import {
  isSafeLocalTestDatabaseUrl,
  isDisposableBrowserValidationAllowed,
} from "@/lib/testing/safe-postgres-validator";

export const PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = false as const;
export const PROMOTIONS_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export class PromotionsProductionLockedError extends Error {
  readonly code = PROMOTIONS_PRODUCTION_BLOCK_REASON;
  constructor(readonly operation: "CAMPAIGN_CREATE" | "CAMPAIGN_UPDATE" | "CAMPAIGN_SUBMIT" | "CAMPAIGN_APPROVE" | "CAMPAIGN_ACTIVATE" | "CODE_GENERATE" | "CODE_VALIDATE" | "EVALUATION" | "RESERVATION" | "COMMITMENT" | "RELEASE" | "REVERSAL" | "BUDGET_MOVEMENT" | "FUNDING_JOURNAL" | "RECONCILIATION") {
    super(`${operation} is inactive until consolidated validation is approved.`);
    this.name = "PromotionsProductionLockedError";
  }
}

export type PromotionsReleaseGate = Readonly<{
  approved: boolean;
  reason: string | null;
}>;

/**
 * Detects whether the given environment is an actual production or live money environment.
 * A bare environment variable or test approval argument must NEVER turn an actual production
 * instance into an authorized promotion environment.
 */
export function isActualProductionInstance(
  source: Record<string, string | undefined> = process.env,
): boolean {
  // Live credentials always mean production / live money
  if (source.PAYSTACK_MODE === "live" || source.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")) {
    return true;
  }

  // If a database URL is present and unsafe (e.g. live, production, remote cloud), it is production
  if (source.DATABASE_URL && !isSafeLocalTestDatabaseUrl(source.DATABASE_URL)) {
    return true;
  }

  // If NODE_ENV is production and not the authenticated isolated disposable browser runtime, it is production
  if (source.NODE_ENV === "production") {
    const isDisposable = isDisposableBrowserValidationAllowed(source as NodeJS.ProcessEnv);
    if (!isDisposable) return true;
  }

  return false;
}

export function evaluatePromotionsReleaseGate(
  source: Record<string, string | undefined> = process.env,
): PromotionsReleaseGate {
  if (PROMOTIONS_PRODUCTION_VALIDATION_APPROVED) {
    return Object.freeze({ approved: true, reason: null });
  }

  // An actual production instance ALWAYS fails closed
  if (isActualProductionInstance(source)) {
    return Object.freeze({ approved: false, reason: PROMOTIONS_PRODUCTION_BLOCK_REASON });
  }

  // Outside production, allow execution only in verified test contexts:
  // 1. Vitest unit & integration test runner (NODE_ENV === "test")
  // 2. Authenticated disposable browser runner (isDisposableBrowserValidationAllowed)
  const isAuthorizedTestContext =
    source.NODE_ENV === "test" ||
    isDisposableBrowserValidationAllowed(source as NodeJS.ProcessEnv);

  return Object.freeze({
    approved: isAuthorizedTestContext,
    reason: isAuthorizedTestContext ? null : PROMOTIONS_PRODUCTION_BLOCK_REASON,
  });
}

/** In production, fails closed until independently approved. In verified test environments, allows execution. */
export function assertPromotionsProductionReady(
  operation: PromotionsProductionLockedError["operation"],
  testApproval?: { approved: true },
  source: Record<string, string | undefined> = process.env,
): void {
  // If PROMOTIONS_PRODUCTION_VALIDATION_APPROVED is false, a bare testApproval argument must NOT
  // turn an actual production instance into an authorized environment.
  if (isActualProductionInstance(source)) {
    throw new PromotionsProductionLockedError(operation);
  }

  if (testApproval?.approved === true) return;

  const gate = evaluatePromotionsReleaseGate(source);
  if (gate.approved) return;
  throw new PromotionsProductionLockedError(operation);
}

export function promotionsProductionReady(
  source: Record<string, string | undefined> = process.env,
): boolean {
  return evaluatePromotionsReleaseGate(source).approved;
}
