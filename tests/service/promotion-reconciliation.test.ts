import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady, PromotionsProductionLockedError, PROMOTIONS_PRODUCTION_BLOCK_REASON } from '@/lib/promotions/production-lock';

describe('promotion-reconciliation service', () => {
  it('RECONCILIATION operation throws PromotionsProductionLockedError', () => {
    expect(() => assertPromotionsProductionReady('RECONCILIATION')).toThrow(PromotionsProductionLockedError);
  });

  it('all operation types throw when lock is active', () => {
    const operations = ['CAMPAIGN_CREATE', 'CAMPAIGN_UPDATE', 'CAMPAIGN_SUBMIT', 'CAMPAIGN_APPROVE', 'CAMPAIGN_ACTIVATE', 'CODE_GENERATE', 'CODE_VALIDATE', 'EVALUATION', 'RESERVATION', 'COMMITMENT', 'RELEASE', 'REVERSAL', 'BUDGET_MOVEMENT', 'FUNDING_JOURNAL', 'RECONCILIATION'] as const;
    for (const op of operations) {
      expect(() => assertPromotionsProductionReady(op)).toThrow(PromotionsProductionLockedError);
    }
  });

  it('PromotionsProductionLockedError has correct code and name', () => {
    const err = new PromotionsProductionLockedError('EVALUATION');
    expect(err.name).toBe('PromotionsProductionLockedError');
    expect(err.code).toBe(PROMOTIONS_PRODUCTION_BLOCK_REASON);
    expect(err.code).toBe('CONSOLIDATED_VALIDATION_NOT_APPROVED');
  });
});
