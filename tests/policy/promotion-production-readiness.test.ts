import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady, promotionsProductionReady, PROMOTIONS_PRODUCTION_VALIDATION_APPROVED } from '@/lib/promotions/production-lock';

describe('Promotion Production Readiness', () => {
  it('PROMOTIONS_PRODUCTION_VALIDATION_APPROVED is false', () => {
    expect(PROMOTIONS_PRODUCTION_VALIDATION_APPROVED).toBe(false);
  });

  it('all operations throw when lock is active', () => {
    expect(() => assertPromotionsProductionReady('EVALUATION')).toThrow();
  });

  it('testApproval bypass works', () => {
    expect(() => assertPromotionsProductionReady('EVALUATION', { approved: true })).not.toThrow();
  });

  it('promotionsProductionReady returns false', () => {
    expect(promotionsProductionReady()).toBe(false);
  });
});
