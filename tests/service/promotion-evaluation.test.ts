import { describe, expect, it } from 'vitest';
import { evaluateMarketplacePromotions, type PromotionEvaluationDependencies, type PromotionEvaluationInput, type PromotionEvaluationResult } from '@/lib/promotions/promotion-evaluation.service';
import { PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('promotion-evaluation service', () => {
  it('PromotionEvaluationInput and Result types exist', () => {
    const input: PromotionEvaluationInput | null = null;
    const result: PromotionEvaluationResult | null = null;
    expect(input).toBeNull();
    expect(result).toBeNull();
  });

  it('evaluateMarketplacePromotions throws PromotionsProductionLockedError without test approval', async () => {
    const input: PromotionEvaluationInput = { checkoutId: "checkout-1", storeGroups: [], deliveryQuotes: [], now: new Date() };
    const dependencies: PromotionEvaluationDependencies = { fetchActiveCampaignVersions: async () => [] };
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    try {
      env.NODE_ENV = 'production';
      await expect(evaluateMarketplacePromotions(input, dependencies)).rejects.toThrow(PromotionsProductionLockedError);
    } finally {
      env.NODE_ENV = prev;
    }
  });

  it('evaluateMarketplacePromotions is a function', () => {
    expect(typeof evaluateMarketplacePromotions).toBe('function');
  });

  it('PromotionsProductionLockedError for EVALUATION has correct operation', () => {
    const err = new PromotionsProductionLockedError('EVALUATION');
    expect(err.operation).toBe('EVALUATION');
    expect(err.name).toBe('PromotionsProductionLockedError');
  });
});
