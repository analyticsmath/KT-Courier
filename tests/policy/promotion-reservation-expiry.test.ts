import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady, promotionsProductionReady, PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('Promotion Reservation Expiry', () => {
  it('throws PromotionsProductionLockedError on assertPromotionsProductionReady RESERVATION', () => {
    expect(() => assertPromotionsProductionReady('RESERVATION', undefined, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('returns false for promotionsProductionReady', () => {
    expect(promotionsProductionReady({ NODE_ENV: 'production' })).toBe(false);
  });

  it('does NOT throw when test approval is provided', () => {
    expect(() => assertPromotionsProductionReady('RESERVATION', { approved: true }, { NODE_ENV: 'production' })).not.toThrow();
  });
});
