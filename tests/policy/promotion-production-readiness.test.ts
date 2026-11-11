import { describe, expect, it } from 'vitest';
import {
  assertPromotionsProductionReady,
  promotionsProductionReady,
  PROMOTIONS_PRODUCTION_VALIDATION_APPROVED,
  PromotionsProductionLockedError,
} from '@/lib/promotions/production-lock';

describe('Promotion Production Readiness', () => {
  it('PROMOTIONS_PRODUCTION_VALIDATION_APPROVED is false', () => {
    expect(PROMOTIONS_PRODUCTION_VALIDATION_APPROVED).toBe(false);
  });

  it('all operations throw when lock is active', () => {
    expect(() => assertPromotionsProductionReady('EVALUATION', undefined, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('testApproval cannot bypass real production instance', () => {
    expect(() => assertPromotionsProductionReady('EVALUATION', { approved: true }, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('testApproval works in explicit test-scope environment', () => {
    const testEnv = { NODE_ENV: 'test', PAYSTACK_MODE: 'test' };
    expect(() => assertPromotionsProductionReady('EVALUATION', { approved: true }, testEnv)).not.toThrow();
  });

  it('promotionsProductionReady returns false in production', () => {
    expect(promotionsProductionReady({ NODE_ENV: 'production' })).toBe(false);
  });

  it('table-driven: proves every money-changing promotion operation rejects real production bypasses', () => {
    const operations: Array<ConstructorParameters<typeof PromotionsProductionLockedError>[0]> = [
      'CAMPAIGN_CREATE',
      'CAMPAIGN_UPDATE',
      'CAMPAIGN_SUBMIT',
      'CAMPAIGN_APPROVE',
      'CAMPAIGN_ACTIVATE',
      'CODE_GENERATE',
      'CODE_VALIDATE',
      'EVALUATION',
      'RESERVATION',
      'COMMITMENT',
      'RELEASE',
      'REVERSAL',
      'BUDGET_MOVEMENT',
      'FUNDING_JOURNAL',
      'RECONCILIATION',
    ];

    for (const op of operations) {
      expect(() => assertPromotionsProductionReady(op, { approved: true }, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
    }
  });
});
