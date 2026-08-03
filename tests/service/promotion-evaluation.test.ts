import { describe, expect, it } from 'vitest';
import { evaluateMarketplacePromotions, type PromotionEvaluationInput, type PromotionEvaluationResult } from '@/lib/promotions/promotion-evaluation.service';
import { PromotionsProductionLockedError } from '@/lib/promotions/production-lock';

describe('promotion-evaluation service', () => {
  it('PromotionEvaluationInput and Result types exist', () => {
    const input: PromotionEvaluationInput | null = null;
    const result: PromotionEvaluationResult | null = null;
    expect(input).toBeNull();
    expect(result).toBeNull();
  });

  it('evaluateMarketplacePromotions throws PromotionsProductionLockedError without test approval', async () => {
    await expect(evaluateMarketplacePromotions({} as any, {} as any)).rejects.toThrow(PromotionsProductionLockedError);
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
