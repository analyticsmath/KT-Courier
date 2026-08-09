import { assertPromotionsProductionReady } from "./production-lock";

export type PromotionReconciliationReason = "BUDGET_MISMATCH" | "EXPIRED_RESERVATION" | "ALLOCATION_MISMATCH";

export async function createReconciliationCase(reason: PromotionReconciliationReason, details: unknown): Promise<unknown> {
  assertPromotionsProductionReady("RECONCILIATION");
  void reason;
  void details;
  return null;
}
