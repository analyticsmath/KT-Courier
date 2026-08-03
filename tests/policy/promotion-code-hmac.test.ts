import { describe, expect, it } from 'vitest';
import { normalizePromotionCode, computeCodeFingerprint, maskPromotionCode, computeCodeHmac } from '@/lib/promotions/promotion-code-policy';

describe('Promotion Code HMAC', () => {
  it('normalizes promotion code correctly', () => {
    expect(normalizePromotionCode('  abc-123  ')).toBe('ABC123');
  });

  it('computes 8-char fingerprint', () => {
    const fingerprint = computeCodeFingerprint('ABC123');
    expect(fingerprint).toHaveLength(8);
  });

  it('masks promotion code correctly', () => {
    expect(maskPromotionCode('ABCDEF')).toBe('AB****EF');
  });

  it('computes consistent hmac on repeated calls', () => {
    const hmac1 = computeCodeHmac('ABC123', 'secret');
    const hmac2 = computeCodeHmac('ABC123', 'secret');
    expect(hmac1).toBe(hmac2);
    expect(typeof hmac1).toBe('string');
  });
});
