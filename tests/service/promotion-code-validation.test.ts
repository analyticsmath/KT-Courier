import { describe, expect, it } from 'vitest';
import { normalizePromotionCode, computeCodeFingerprint, computeCodeHmac, maskPromotionCode, checkCodeBruteForceProtection } from '@/lib/promotions/promotion-code-policy';

describe('promotion-code-validation service', () => {
  it('normalizePromotionCode removes spaces and dashes, uppercases', () => {
    expect(normalizePromotionCode('  abc-123  ')).toBe('ABC123');
    expect(normalizePromotionCode('hello world')).toBe('HELLOWORLD');
    expect(normalizePromotionCode('TEST-CODE-99')).toBe('TESTCODE99');
  });

  it('computeCodeFingerprint returns consistent string', () => {
    const fp1 = computeCodeFingerprint('ABC123');
    const fp2 = computeCodeFingerprint('ABC123');
    expect(fp1).toBe(fp2);
    expect(typeof fp1).toBe('string');
    expect(fp1.length).toBeGreaterThan(0);
  });

  it('computeCodeHmac is deterministic for same input', () => {
    const hmac1 = computeCodeHmac('ABC123', 'secret');
    const hmac2 = computeCodeHmac('ABC123', 'secret');
    expect(hmac1).toBe(hmac2);
    expect(typeof hmac1).toBe('string');
  });

  it('maskPromotionCode hides middle characters', () => {
    const masked = maskPromotionCode('ABCDEF');
    expect(masked).toContain('**');
    expect(masked).not.toBe('ABCDEF');
  });

  it('checkCodeBruteForceProtection allows 4 or fewer but blocks 5+', () => {
    expect(() => checkCodeBruteForceProtection(3)).not.toThrow();
    expect(() => checkCodeBruteForceProtection(4)).not.toThrow();
    expect(() => checkCodeBruteForceProtection(5)).toThrow();
    expect(() => checkCodeBruteForceProtection(6)).toThrow();
  });
});
