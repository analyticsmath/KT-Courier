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

export function evaluatePromotionsReleaseGate(
  source: Record<string, string | undefined> = process.env,
): PromotionsReleaseGate {
  const isProduction = source.NODE_ENV === "production";
  const isTestOrDisposable =
    source.NODE_ENV === "test" ||
    source.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1" ||
    source.KT_PROMOTIONS_TEST_APPROVED === "true";
  const approved = (!isProduction && isTestOrDisposable) || PROMOTIONS_PRODUCTION_VALIDATION_APPROVED;
  return Object.freeze({
    approved,
    reason: approved ? null : PROMOTIONS_PRODUCTION_BLOCK_REASON,
  });
}

/** In production, fails closed until independently approved. In verified test environments, allows execution. */
export function assertPromotionsProductionReady(
  operation: PromotionsProductionLockedError["operation"],
  testApproval?: { approved: true },
  source: Record<string, string | undefined> = process.env,
): void {
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
