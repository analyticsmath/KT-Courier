import { assertPromotionsProductionReady } from "./production-lock";

export type PromotionReconciliationReason = "BUDGET_MISMATCH" | "EXPIRED_RESERVATION" | "ALLOCATION_MISMATCH";

export async function createReconciliationCase(reason: PromotionReconciliationReason, details: any): Promise<any> {
  assertPromotionsProductionReady("RECONCILIATION");
  return null;
}
