import { describe, expect, it } from 'vitest';
import { commitMarketplacePromotionRedemptions, type RedemptionCommitInput, type RedemptionCommitResult } from '@/lib/promotions/promotion-redemption.service';
import { PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('promotion-redemption service', () => {
  it('commitMarketplacePromotionRedemptions throws PromotionsProductionLockedError', async () => {
    await expect(commitMarketplacePromotionRedemptions({} as any, {} as any)).rejects.toThrow(PromotionsProductionLockedError);
  });

  it('RedemptionCommitInput and RedemptionCommitResult types exist', () => {
    const input: RedemptionCommitInput | null = null;
    const result: RedemptionCommitResult | null = null;
    expect(input).toBeNull();
    expect(result).toBeNull();
  });

  it('commitMarketplacePromotionRedemptions is a function', () => {
    expect(typeof commitMarketplacePromotionRedemptions).toBe('function');
  });

  it('PromotionsProductionLockedError for COMMITMENT has correct operation', () => {
    const err = new PromotionsProductionLockedError('COMMITMENT');
    expect(err.operation).toBe('COMMITMENT');
    expect(err.name).toBe('PromotionsProductionLockedError');
  });
});
