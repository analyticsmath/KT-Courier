import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady, PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('Promotion Redemption Commit', () => {
  it('throws on COMMITMENT', () => {
    expect(() => assertPromotionsProductionReady('COMMITMENT', undefined, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('rejects COMMITMENT with test approval under production environment', () => {
    expect(() => assertPromotionsProductionReady('COMMITMENT', { approved: true }, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('allows COMMITMENT with test approval in verified test-only environment', () => {
    expect(() => assertPromotionsProductionReady('COMMITMENT', { approved: true }, { NODE_ENV: 'test', PAYSTACK_MODE: 'test' })).not.toThrow();
  });

  it('throws on RELEASE', () => {
    expect(() => assertPromotionsProductionReady('RELEASE', undefined, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('throws on BUDGET_MOVEMENT', () => {
    expect(() => assertPromotionsProductionReady('BUDGET_MOVEMENT', undefined, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });
});
