import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady } from '@/lib/promotions/production-lock';

describe('Promotion Redemption Commit', () => {
  it('throws on COMMITMENT', () => {
    expect(() => assertPromotionsProductionReady('COMMITMENT', undefined, { NODE_ENV: 'production' })).toThrow();
  });

  it('does not throw on COMMITMENT with test approval', () => {
    expect(() => assertPromotionsProductionReady('COMMITMENT', { approved: true }, { NODE_ENV: 'production' })).not.toThrow();
  });

  it('throws on RELEASE', () => {
    expect(() => assertPromotionsProductionReady('RELEASE', undefined, { NODE_ENV: 'production' })).toThrow();
  });

  it('throws on BUDGET_MOVEMENT', () => {
    expect(() => assertPromotionsProductionReady('BUDGET_MOVEMENT', undefined, { NODE_ENV: 'production' })).toThrow();
  });
});
