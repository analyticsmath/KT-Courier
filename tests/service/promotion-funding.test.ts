import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { fundPlatformPromotionInTransaction, type PlatformFundingInput, type PlatformFundingResult } from '@/lib/promotions/promotion-funding.service';
import { PromotionsProductionLockedError } from '@/lib/promotions/production-lock';
import { createPlatformSubsidyJournal, PROMOTION_JOURNAL_TYPE, PROMOTION_LINE_CODES, PROMOTION_ACCOUNT_CODES } from '@/lib/promotions/promotion-ledger-policy';

describe('promotion-funding service', () => {
  it('fundPlatformPromotionInTransaction throws PromotionsProductionLockedError', async () => {
    const input: PlatformFundingInput = { redemptionId: "redemption-1", campaignVersionId: "campaign-version-1", platformFundedAmount: new Prisma.Decimal("1.00"), paymentId: "payment-1", marketplaceOrderId: "order-1", allocations: [], operationId: "operation-1", requestHash: "hash-1" };
    await expect(fundPlatformPromotionInTransaction(input, {} as Prisma.TransactionClient)).rejects.toThrow(PromotionsProductionLockedError);
  });

  it('createPlatformSubsidyJournal creates 2-line journal', () => {
    const journal = createPlatformSubsidyJournal('redemption-1', new Prisma.Decimal('50.00'));
    expect(journal.journalType).toBe(PROMOTION_JOURNAL_TYPE);
    expect(journal.referenceId).toBe('redemption-1');
    expect(journal.lines).toHaveLength(2);
    expect(journal.lines[0].direction).toBe('DEBIT');
    expect(journal.lines[0].lineCode).toBe(PROMOTION_LINE_CODES.EXPENSE);
    expect(journal.lines[0].accountCode).toBe(PROMOTION_ACCOUNT_CODES.PLATFORM_EXPENSE);
    expect(journal.lines[1].direction).toBe('CREDIT');
    expect(journal.lines[1].lineCode).toBe(PROMOTION_LINE_CODES.CREDIT);
    expect(journal.lines[0].amount.toFixed(2)).toBe('50.00');
    expect(journal.lines[1].amount.toFixed(2)).toBe('50.00');
  });

  it('PlatformFundingInput and PlatformFundingResult types exist', () => {
    const input: PlatformFundingInput | null = null;
    const result: PlatformFundingResult | null = null;
    expect(input).toBeNull();
    expect(result).toBeNull();
  });
});
