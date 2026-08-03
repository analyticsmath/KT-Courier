import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculateAvailableBudget, isBudgetExhausted, type BudgetState } from '@/lib/promotions/promotion-budget-policy';

const makeState = (approved: string, reserved: string, committed: string, released = '0', reversed = '0'): BudgetState => ({
  version: 1,
  approvedAmount: new Prisma.Decimal(approved),
  reservedAmount: new Prisma.Decimal(reserved),
  committedAmount: new Prisma.Decimal(committed),
  releasedAmount: new Prisma.Decimal(released),
  reversedAmount: new Prisma.Decimal(reversed),
  dailyCommitmentSum: new Prisma.Decimal('0'),
});

describe('Promotion Budget Lifecycle', () => {
  it('calculates available budget with no activity equals approvedAmount', () => {
    const budget = makeState('1000', '0', '0');
    expect(calculateAvailableBudget(budget).toFixed(2)).toBe('1000.00');
  });

  it('calculates available R900 with reserved R100 from R1000', () => {
    const budget = makeState('1000', '100', '0');
    expect(calculateAvailableBudget(budget).toFixed(2)).toBe('900.00');
  });

  it('calculates correctly with committed R200, released R50', () => {
    const budget = makeState('1000', '100', '200', '50', '25'); // 1000 - 100 - 200 + 50 + 25 = 775
    expect(calculateAvailableBudget(budget).toFixed(2)).toBe('775.00');
  });

  it('returns true for isBudgetExhausted when available < 0.01', () => {
    expect(isBudgetExhausted(makeState('0', '0', '0'))).toBe(true);
    expect(isBudgetExhausted(makeState('0.005', '0', '0'))).toBe(true);
    expect(isBudgetExhausted(makeState('0.01', '0', '0'))).toBe(false);
  });
});
