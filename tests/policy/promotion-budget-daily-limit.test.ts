import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { validateBudgetMovement } from '@/lib/promotions/promotion-budget-policy';
import { PromotionBudgetError } from '@/lib/promotions/promotion-errors';

describe('Promotion Budget Daily Limit', () => {
  it('does not throw for COMMIT within daily limit', () => {
    const state = {
      version: 1,
      approvedAmount: new Prisma.Decimal('1000'),
      reservedAmount: new Prisma.Decimal('0'),
      committedAmount: new Prisma.Decimal('0'),
      releasedAmount: new Prisma.Decimal('0'),
      reversedAmount: new Prisma.Decimal('0'),
      dailyCommitmentSum: new Prisma.Decimal('50'),
      dailyLimitAmount: new Prisma.Decimal('200')
    };
    expect(() => validateBudgetMovement(
      state,
      new Prisma.Decimal('100'),
      'COMMIT'
    )).not.toThrow();
  });

  it('throws DAILY_LIMIT_EXCEEDED for COMMIT exceeding daily limit', () => {
    const state = {
      version: 1,
      approvedAmount: new Prisma.Decimal('1000'),
      reservedAmount: new Prisma.Decimal('0'),
      committedAmount: new Prisma.Decimal('0'),
      releasedAmount: new Prisma.Decimal('0'),
      reversedAmount: new Prisma.Decimal('0'),
      dailyCommitmentSum: new Prisma.Decimal('50'),
      dailyLimitAmount: new Prisma.Decimal('200')
    };
    expect(() => validateBudgetMovement(
      state,
      new Prisma.Decimal('200'),
      'COMMIT'
    )).toThrowError(PromotionBudgetError);
  });

  it('throws BUDGET_EXHAUSTED for RESERVE exceeding available', () => {
    const state = {
      version: 1,
      approvedAmount: new Prisma.Decimal('1000'),
      reservedAmount: new Prisma.Decimal('0'),
      committedAmount: new Prisma.Decimal('0'),
      releasedAmount: new Prisma.Decimal('0'),
      reversedAmount: new Prisma.Decimal('0'),
      dailyCommitmentSum: new Prisma.Decimal('0'),
      dailyLimitAmount: new Prisma.Decimal('2000')
    };
    expect(() => validateBudgetMovement(
      state,
      new Prisma.Decimal('1500'),
      'RESERVE'
    )).toThrowError(PromotionBudgetError);
  });
});
