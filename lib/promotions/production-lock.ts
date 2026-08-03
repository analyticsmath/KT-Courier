export const PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = false as const;
export const PROMOTIONS_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export class PromotionsProductionLockedError extends Error {
  readonly code = PROMOTIONS_PRODUCTION_BLOCK_REASON;
  constructor(readonly operation: "CAMPAIGN_CREATE" | "CAMPAIGN_UPDATE" | "CAMPAIGN_SUBMIT" | "CAMPAIGN_APPROVE" | "CAMPAIGN_ACTIVATE" | "CODE_GENERATE" | "CODE_VALIDATE" | "EVALUATION" | "RESERVATION" | "COMMITMENT" | "RELEASE" | "REVERSAL" | "BUDGET_MOVEMENT" | "FUNDING_JOURNAL" | "RECONCILIATION") {
    super(`${operation} is inactive until consolidated validation is approved.`);
    this.name = "PromotionsProductionLockedError";
  }
}

/** There is intentionally no environment-variable bypass. */
export function assertPromotionsProductionReady(
  operation: PromotionsProductionLockedError["operation"],
  testApproval?: { approved: true },
): void {
  if (PROMOTIONS_PRODUCTION_VALIDATION_APPROVED || testApproval?.approved === true) return;
  throw new PromotionsProductionLockedError(operation);
}

export function promotionsProductionReady(): boolean {
  return PROMOTIONS_PRODUCTION_VALIDATION_APPROVED;
}
