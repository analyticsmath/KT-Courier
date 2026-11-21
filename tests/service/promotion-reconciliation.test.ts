import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady, PromotionsProductionLockedError, PROMOTIONS_PRODUCTION_BLOCK_REASON } from '@/lib/promotions/production-lock';

describe('promotion-reconciliation service', () => {
  it('cleanup operations (RECONCILIATION, RELEASE, REVERSAL) remain available even when KT_COMMERCE_ENABLED is false', () => {
    for (const op of ['RELEASE', 'REVERSAL', 'RECONCILIATION'] as const) {
      expect(() => assertPromotionsProductionReady(op, undefined, { NODE_ENV: 'production', KT_COMMERCE_ENABLED: 'false' })).not.toThrow();
    }
  });

  it('commercial operations throw when KT_COMMERCE_ENABLED is false in production', () => {
    const operations = ['CAMPAIGN_CREATE', 'CAMPAIGN_UPDATE', 'CAMPAIGN_SUBMIT', 'CAMPAIGN_APPROVE', 'CAMPAIGN_ACTIVATE', 'CODE_GENERATE', 'CODE_VALIDATE', 'EVALUATION', 'RESERVATION', 'COMMITMENT', 'BUDGET_MOVEMENT', 'FUNDING_JOURNAL'] as const;
    for (const op of operations) {
      expect(() => assertPromotionsProductionReady(op, undefined, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
    }
  });

  it('PromotionsProductionLockedError has correct code and name', () => {
    const err = new PromotionsProductionLockedError('EVALUATION');
    expect(err.name).toBe('PromotionsProductionLockedError');
    expect(err.code).toBe(PROMOTIONS_PRODUCTION_BLOCK_REASON);
    expect(err.code).toBe('COMMERCE_DISABLED_BY_GLOBAL_SWITCH');
  });
});
