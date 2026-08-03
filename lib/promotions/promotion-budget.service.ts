import { Decimal } from '@prisma/client/runtime/library';
import { assertPromotionsProductionReady } from './production-lock';
import { validateBudgetMovement, isBudgetExhausted, type BudgetState, calculateAvailableBudget } from './promotion-budget-policy';
import { PromotionBudgetRepo } from './promotion-repositories';

export interface BudgetMovementInput {
  budgetId: string;
  campaignVersionId: string;
  movementType: 'RESERVE' | 'COMMIT' | 'RELEASE' | 'REVERSE' | 'EXPIRE' | 'APPROVED_INCREASE' | 'APPROVED_DECREASE';
  amount: Decimal;
  operationId: string;
  requestHash: string;
  checkoutId?: string;
  storeOrderId?: string;
  redemptionId?: string;
}

export interface BudgetMovementResult {
  movementId: string;
  budgetId: string;
  movementType: string;
  amount: Decimal;
  balanceAfter: Decimal;
  budgetVersion: number;
}

type PrismaTransactionClient = Parameters<Parameters<import('@prisma/client').PrismaClient['$transaction']>[0]>[0];

export async function recordBudgetMovement(input: BudgetMovementInput, tx: PrismaTransactionClient): Promise<BudgetMovementResult> {
  assertPromotionsProductionReady('BUDGET_MOVEMENT');

  const budgetRecord = await tx.promotionBudget.findUniqueOrThrow({
    where: { id: input.budgetId },
  });

  const budgetState: BudgetState = {
    version: budgetRecord.version,
    approvedAmount: new Decimal(budgetRecord.approvedAmount),
    reservedAmount: new Decimal(budgetRecord.reservedAmount),
    committedAmount: new Decimal(budgetRecord.committedAmount),
    releasedAmount: new Decimal(budgetRecord.releasedAmount),
    reversedAmount: new Decimal(budgetRecord.reversedAmount),
    dailyCommitmentSum: new Decimal((budgetRecord as any).dailyCommitmentSum ?? 0),
    dailyLimitAmount: budgetRecord.dailyLimit ? new Decimal(budgetRecord.dailyLimit) : undefined,
  };

  if (input.movementType === 'RESERVE' || input.movementType === 'COMMIT' || input.movementType === 'RELEASE' || input.movementType === 'REVERSE') {
    validateBudgetMovement(budgetState, input.amount, input.movementType);
  }

  // Calculate new amounts
  if (input.movementType === 'RESERVE') budgetState.reservedAmount = budgetState.reservedAmount.plus(input.amount);
  if (input.movementType === 'COMMIT') budgetState.committedAmount = budgetState.committedAmount.plus(input.amount);
  if (input.movementType === 'RELEASE') budgetState.releasedAmount = budgetState.releasedAmount.plus(input.amount);
  if (input.movementType === 'REVERSE') budgetState.reversedAmount = budgetState.reversedAmount.plus(input.amount);
  if (input.movementType === 'EXPIRE') budgetState.releasedAmount = budgetState.releasedAmount.plus(input.amount); // expire reserve = release
  if (input.movementType === 'APPROVED_INCREASE') budgetState.approvedAmount = budgetState.approvedAmount.plus(input.amount);
  if (input.movementType === 'APPROVED_DECREASE') budgetState.approvedAmount = budgetState.approvedAmount.minus(input.amount);

  budgetState.version += 1;

  const balanceAfter = calculateAvailableBudget(budgetState);

  await PromotionBudgetRepo.updateOptimistic(input.budgetId, budgetRecord.version, {
    approvedAmount: budgetState.approvedAmount,
    reservedAmount: budgetState.reservedAmount,
    committedAmount: budgetState.committedAmount,
    releasedAmount: budgetState.releasedAmount,
    reversedAmount: budgetState.reversedAmount,
    status: isBudgetExhausted(budgetState) ? 'EXHAUSTED' : 'ACTIVE',
  } as any, tx);

  const movement = await tx.promotionBudgetMovement.create({
    data: {
      budgetId: input.budgetId,
      movementType: input.movementType,
      amount: input.amount,
      balanceAfter,
      budgetVersion: budgetState.version,
      operationId: input.operationId,
      requestHash: input.requestHash,
      checkoutId: input.checkoutId,
      storeOrderId: input.storeOrderId,
      redemptionId: input.redemptionId,
    } as any
  });

  return {
    movementId: movement.id,
    budgetId: input.budgetId,
    movementType: input.movementType,
    amount: input.amount,
    balanceAfter,
    budgetVersion: budgetState.version,
  };
}
