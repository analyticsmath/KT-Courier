import { describe, expect, it } from 'vitest';
import { validateCampaignTransition, validateCampaignImmutability, validateFundingConfiguration } from '@/lib/promotions/promotion-policy';

describe('promotion-store API contract', () => {
  it('store cannot activate directly from DRAFT', () => {
    expect(() => validateCampaignTransition({ currentStatus: 'DRAFT', targetStatus: 'ACTIVE' })).toThrow();
  });

  it('validateCampaignImmutability allows DRAFT but throws on ACTIVE', () => {
    expect(() => validateCampaignImmutability('ACTIVE')).toThrow();
    expect(() => validateCampaignImmutability('DRAFT')).not.toThrow();
  });

  it('STORE funding requires ownerStoreId', () => {
    expect(() => validateFundingConfiguration('STORE', 10000)).toThrow();
    expect(() => validateFundingConfiguration('STORE', 10000, 'store-1')).not.toThrow();
  });

  it('SHARED funding requires ownerStoreId', () => {
    expect(() => validateFundingConfiguration('SHARED', 5000)).toThrow();
    expect(() => validateFundingConfiguration('SHARED', 5000, 'store-1')).not.toThrow();
  });

  it('PLATFORM funding does not require ownerStoreId', () => {
    expect(() => validateFundingConfiguration('PLATFORM', 0)).not.toThrow();
  });

  it('SHARED with invalid bps throws', () => {
    expect(() => validateFundingConfiguration('SHARED', 15000, 'store-1')).toThrow();
    expect(() => validateFundingConfiguration('SHARED', -100, 'store-1')).toThrow();
  });
});
