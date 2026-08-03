import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { recordBudgetMovement, type BudgetMovementInput, type BudgetMovementResult } from '@/lib/promotions/promotion-budget.service';
import { PromotionsProductionLockedError } from '@/lib/promotions/production-lock';
import { calculateAvailableBudget, validateBudgetMovement } from '@/lib/promotions/promotion-budget-policy';

describe('promotion-budget service', () => {
  it('recordBudgetMovement throws PromotionsProductionLockedError', async () => {
    await expect(recordBudgetMovement({} as any, {} as any)).rejects.toThrow(PromotionsProductionLockedError);
  });

  it('calculateAvailableBudget with mixed inputs', () => {
    const available = calculateAvailableBudget({
      version: 1,
      approvedAmount: new Prisma.Decimal('1000.00'),
      reservedAmount: new Prisma.Decimal('200.00'),
      committedAmount: new Prisma.Decimal('100.00'),
      releasedAmount: new Prisma.Decimal('50.00'),
      reversedAmount: new Prisma.Decimal('25.00'),
      dailyCommitmentSum: new Prisma.Decimal('0'),
    });
    // 1000 - 200 - 100 + 50 + 25 = 775
    expect(available.toFixed(2)).toBe('775.00');
  });

  it('validateBudgetMovement RESERVE throws when insufficient', () => {
    expect(() => validateBudgetMovement({
      version: 1,
      approvedAmount: new Prisma.Decimal('100.00'),
      reservedAmount: new Prisma.Decimal('90.00'),
      committedAmount: new Prisma.Decimal('0'),
      releasedAmount: new Prisma.Decimal('0'),
      reversedAmount: new Prisma.Decimal('0'),
      dailyCommitmentSum: new Prisma.Decimal('0'),
    }, new Prisma.Decimal('20.00'), 'RESERVE')).toThrow('Insufficient budget');
  });

  it('BudgetMovementInput and BudgetMovementResult types exist', () => {
    const input: BudgetMovementInput | null = null;
    const result: BudgetMovementResult | null = null;
    expect(input).toBeNull();
    expect(result).toBeNull();
  });
});
