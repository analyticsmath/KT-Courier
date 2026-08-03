import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady, promotionsProductionReady, PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('Promotion Reservation Expiry', () => {
  it('throws PromotionsProductionLockedError on assertPromotionsProductionReady RESERVATION', () => {
    expect(() => assertPromotionsProductionReady('RESERVATION')).toThrow(PromotionsProductionLockedError);
  });

  it('returns false for promotionsProductionReady', () => {
    expect(promotionsProductionReady()).toBe(false);
  });

  it('does NOT throw when test approval is provided', () => {
    expect(() => assertPromotionsProductionReady('RESERVATION', { approved: true })).not.toThrow();
  });
});
