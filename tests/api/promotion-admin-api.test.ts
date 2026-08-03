import { describe, expect, it } from 'vitest';
import { validateCampaignTransition } from '@/lib/promotions/promotion-policy';
import { maskPromotionCode } from '@/lib/promotions/promotion-code-policy';
import { assertPromotionsProductionReady, PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('promotion-admin API contract', () => {
  it('full lifecycle transitions succeed', () => {
    expect(() => validateCampaignTransition({ currentStatus: 'DRAFT', targetStatus: 'UNDER_REVIEW' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'UNDER_REVIEW', targetStatus: 'APPROVED' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'APPROVED', targetStatus: 'ACTIVE' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'ACTIVE', targetStatus: 'PAUSED' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'ACTIVE', targetStatus: 'ENDED' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'ENDED', targetStatus: 'RETIRED' })).not.toThrow();
  });

  it('RETIRED cannot transition to ACTIVE', () => {
    expect(() => validateCampaignTransition({ currentStatus: 'RETIRED', targetStatus: 'ACTIVE' })).toThrow();
  });

  it('maskPromotionCode masks without raw exposure', () => {
    const masked = maskPromotionCode('SECRETCODE');
    expect(masked).toContain('**');
    expect(masked).not.toBe('SECRETCODE');
  });

  it('assertPromotionsProductionReady blocks manual actions', () => {
    expect(() => assertPromotionsProductionReady('COMMITMENT')).toThrow(PromotionsProductionLockedError);
    expect(() => assertPromotionsProductionReady('EVALUATION')).toThrow(PromotionsProductionLockedError);
    expect(() => assertPromotionsProductionReady('BUDGET_MOVEMENT')).toThrow(PromotionsProductionLockedError);
  });
});
