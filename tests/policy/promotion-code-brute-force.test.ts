import { describe, expect, it } from 'vitest';
import { checkCodeBruteForceProtection } from '@/lib/promotions/promotion-code-policy';

describe('Promotion Code Brute Force', () => {
  it('does not throw for 4 attempts', () => {
    expect(() => checkCodeBruteForceProtection(4)).not.toThrow();
  });

  it('throws for 5 attempts', () => {
    expect(() => checkCodeBruteForceProtection(5)).toThrow();
  });

  it('throws for 6 attempts', () => {
    expect(() => checkCodeBruteForceProtection(6)).toThrow();
  });
});
