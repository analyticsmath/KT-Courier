import { describe, expect, it } from 'vitest';
import { validateCampaignTransition, validateCampaignImmutability } from '@/lib/promotions/promotion-policy';

describe('Promotion Campaign Lifecycle', () => {
  it('allows valid transitions', () => {
    expect(() => validateCampaignTransition({ currentStatus: 'DRAFT', targetStatus: 'UNDER_REVIEW' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'ACTIVE', targetStatus: 'PAUSED' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'UNDER_REVIEW', targetStatus: 'APPROVED' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'APPROVED', targetStatus: 'ACTIVE' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'PAUSED', targetStatus: 'ACTIVE' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'ACTIVE', targetStatus: 'ENDED' })).not.toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'ENDED', targetStatus: 'RETIRED' })).not.toThrow();
  });

  it('throws on invalid transitions', () => {
    expect(() => validateCampaignTransition({ currentStatus: 'DRAFT', targetStatus: 'ACTIVE' })).toThrow();
    expect(() => validateCampaignTransition({ currentStatus: 'RETIRED', targetStatus: 'DRAFT' })).toThrow();
  });

  it('throws on immutable status', () => {
    expect(() => validateCampaignImmutability('ACTIVE')).toThrow();
  });

  it('passes on mutable status', () => {
    expect(() => validateCampaignImmutability('DRAFT')).not.toThrow();
  });
});
