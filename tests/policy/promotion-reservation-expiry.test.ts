import { describe, expect, it } from 'vitest';
import { assertPromotionsProductionReady, promotionsProductionReady, PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('Promotion Reservation Expiry', () => {
  it('throws PromotionsProductionLockedError on assertPromotionsProductionReady RESERVATION', () => {
    expect(() => assertPromotionsProductionReady('RESERVATION', undefined, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('returns false for promotionsProductionReady in production', () => {
    expect(promotionsProductionReady({ NODE_ENV: 'production' })).toBe(false);
  });

  it('throws when test approval is provided under production environment', () => {
    expect(() => assertPromotionsProductionReady('RESERVATION', { approved: true }, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('allows RESERVATION with test approval in verified test-only environment', () => {
    expect(() => assertPromotionsProductionReady('RESERVATION', { approved: true }, { NODE_ENV: 'test', PAYSTACK_MODE: 'test' })).not.toThrow();
  });
});
