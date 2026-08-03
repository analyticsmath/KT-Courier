import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { createPlatformSubsidyJournal } from '@/lib/promotions/promotion-ledger-policy';

describe('Promotion Platform Subsidy', () => {
  it('creates journal with correct DEBIT and CREDIT', () => {
    const journal = createPlatformSubsidyJournal(
      'redemp-1',
      new Prisma.Decimal('50')
    );
    expect(journal.lines).toContainEqual(expect.objectContaining({ lineCode: 'PLATFORM_PROMO_EXPENSE', direction: 'DEBIT' }));
    expect(journal.lines).toContainEqual(expect.objectContaining({ lineCode: 'CUSTOMER_FUNDS_PROMO_CREDIT', direction: 'CREDIT' }));
  });

  it('amount matches platformFundingAmount', () => {
    const journal = createPlatformSubsidyJournal(
      'redemp-1',
      new Prisma.Decimal('50')
    );
    expect(journal.lines[0].amount).toEqual(new Prisma.Decimal('50'));
    expect(journal.lines[1].amount).toEqual(new Prisma.Decimal('50'));
  });

  it('journal type is PROMOTION_SUBSIDY', () => {
    const journal = createPlatformSubsidyJournal(
      'redemp-1',
      new Prisma.Decimal('50')
    );
    expect(journal.journalType).toBe('PROMOTION_SUBSIDY');
  });
});
