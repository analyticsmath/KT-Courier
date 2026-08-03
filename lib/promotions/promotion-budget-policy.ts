import { Decimal } from "@prisma/client/runtime/library";
import { PromotionBudgetError } from "./promotion-errors";

export interface BudgetState {
  version: number;
  approvedAmount: Decimal;
  reservedAmount: Decimal;
  committedAmount: Decimal;
  releasedAmount: Decimal;
  reversedAmount: Decimal;
  dailyCommitmentSum: Decimal;
  dailyLimitAmount?: Decimal;
}

export function calculateAvailableBudget(state: BudgetState): Decimal {
  return state.approvedAmount
    .minus(state.reservedAmount)
    .minus(state.committedAmount)
    .plus(state.releasedAmount)
    .plus(state.reversedAmount);
}

export function validateBudgetMovement(
  state: BudgetState,
  amount: Decimal,
  movementType: "RESERVE" | "COMMIT" | "RELEASE" | "REVERSE"
): void {
  if (amount.lessThanOrEqualTo(0)) {
    throw new PromotionBudgetError("INVALID_AMOUNT", "Budget movement amount must be positive.");
  }

  if (movementType === "RESERVE") {
    const available = calculateAvailableBudget(state);
    if (available.lessThan(amount)) {
      throw new PromotionBudgetError("BUDGET_EXHAUSTED", "Insufficient budget available for reservation.");
    }
  }

  if (movementType === "COMMIT" && state.dailyLimitAmount) {
    const newDailySum = state.dailyCommitmentSum.plus(amount);
    if (newDailySum.greaterThan(state.dailyLimitAmount)) {
      throw new PromotionBudgetError("DAILY_LIMIT_EXCEEDED", "Daily budget limit exceeded.");
    }
  }
}

export function isBudgetExhausted(state: BudgetState): boolean {
  const available = calculateAvailableBudget(state);
  return available.lessThan(new Decimal("0.01"));
}
