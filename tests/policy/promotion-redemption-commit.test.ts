import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady } from '@/lib/promotions/production-lock';

describe('Promotion Redemption Commit', () => {
  it('throws on COMMITMENT', () => {
    expect(() => assertPromotionsProductionReady('COMMITMENT')).toThrow();
  });

  it('does not throw on COMMITMENT with test approval', () => {
    expect(() => assertPromotionsProductionReady('COMMITMENT', { approved: true })).not.toThrow();
  });

  it('throws on RELEASE', () => {
    expect(() => assertPromotionsProductionReady('RELEASE')).toThrow();
  });

  it('throws on BUDGET_MOVEMENT', () => {
    expect(() => assertPromotionsProductionReady('BUDGET_MOVEMENT')).toThrow();
  });
});
