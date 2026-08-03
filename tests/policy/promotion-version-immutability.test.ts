import { describe, expect, it } from 'vitest';
import { validateCampaignImmutability } from '@/lib/promotions/promotion-policy';

describe('Promotion Version Immutability', () => {
  it('throws for ACTIVE status', () => {
    expect(() => validateCampaignImmutability('ACTIVE')).toThrow();
  });

  it('throws for PAUSED status', () => {
    expect(() => validateCampaignImmutability('PAUSED')).toThrow();
  });

  it('throws for ENDED status', () => {
    expect(() => validateCampaignImmutability('ENDED')).toThrow();
  });

  it('does not throw for DRAFT status', () => {
    expect(() => validateCampaignImmutability('DRAFT')).not.toThrow();
  });
});
