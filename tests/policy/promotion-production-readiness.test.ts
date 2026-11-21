import { describe, expect, it } from 'vitest';
import {
  assertPromotionsProductionReady,
  promotionsProductionReady,
  PROMOTIONS_PRODUCTION_BLOCK_REASON,
  PROMOTIONS_PRODUCTION_VALIDATION_APPROVED,
  PromotionsProductionLockedError,
} from '@/lib/promotions/production-lock';
import { ADVERTISING_PRODUCTION_VALIDATION_APPROVED } from '@/lib/advertising/production-lock';
import { PROMOTERS_PRODUCTION_VALIDATION_APPROVED } from '@/lib/promoters/production-readiness';

describe('Promotion Production Readiness (C04)', () => {
  it('opens in-scope promotions behind KT_COMMERCE_ENABLED while keeping advertising and promoters locked', () => {
    expect(PROMOTIONS_PRODUCTION_VALIDATION_APPROVED).toBe(true);
    expect(ADVERTISING_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(PROMOTERS_PRODUCTION_VALIDATION_APPROVED).toBe(false);
  });

  it('commercial creation operations throw in production when KT_COMMERCE_ENABLED is not true', () => {
    expect(() => assertPromotionsProductionReady('EVALUATION', undefined, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
    expect(promotionsProductionReady({ NODE_ENV: 'production' })).toBe(false);
  });

  it('allows promotions in production when KT_COMMERCE_ENABLED=true', () => {
    expect(promotionsProductionReady({ NODE_ENV: 'production', KT_COMMERCE_ENABLED: 'true' })).toBe(true);
    expect(() => assertPromotionsProductionReady('EVALUATION', undefined, { NODE_ENV: 'production', KT_COMMERCE_ENABLED: 'true' })).not.toThrow();
  });

  it('testApproval cannot bypass disabled KT_COMMERCE_ENABLED in real production instance', () => {
    expect(() => assertPromotionsProductionReady('EVALUATION', { approved: true }, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
  });

  it('testApproval works in explicit test-scope environment', () => {
    const testEnv = { NODE_ENV: 'test', PAYSTACK_MODE: 'test' };
    expect(() => assertPromotionsProductionReady('EVALUATION', { approved: true }, testEnv)).not.toThrow();
  });

  it('table-driven: commercial promotion operations respect KT_COMMERCE_ENABLED=false in production while cleanup remains active', () => {
    const gatedOperations: Array<ConstructorParameters<typeof PromotionsProductionLockedError>[0]> = [
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
      'BUDGET_MOVEMENT',
      'FUNDING_JOURNAL',
    ];

    for (const op of gatedOperations) {
      expect(() => assertPromotionsProductionReady(op, { approved: true }, { NODE_ENV: 'production' })).toThrow(PromotionsProductionLockedError);
    }

    const cleanupOperations: Array<ConstructorParameters<typeof PromotionsProductionLockedError>[0]> = [
      'RELEASE',
      'REVERSAL',
      'RECONCILIATION',
    ];
    for (const op of cleanupOperations) {
      expect(() => assertPromotionsProductionReady(op, undefined, { NODE_ENV: 'production', KT_COMMERCE_ENABLED: 'false' })).not.toThrow();
    }
    expect(PROMOTIONS_PRODUCTION_BLOCK_REASON).toBe('COMMERCE_DISABLED_BY_GLOBAL_SWITCH');
  });
});
