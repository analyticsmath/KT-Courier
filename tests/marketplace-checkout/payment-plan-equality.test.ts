import { describe, expect, it } from "vitest";
import { marketplacePaymentPlansEqual } from "@/lib/marketplace-checkout/payment-plan";

describe("marketplace payment plan evidence equality", () => {
  it("treats JSONB key reordering as semantically identical", () => {
    const fresh = {
      version: "marketplace-payment-v1",
      mode: "DEPOSIT_PLUS_COD",
      authoritativeTotal: "200.00",
      digitalRequired: "100.00",
      cashRequired: "100.00",
      policyId: "policy-1",
      policyVersion: 4,
      policyEvidence: {
        id: "policy-1",
        version: 4,
        mode: "DEPOSIT_PLUS_COD",
        depositAmount: null,
        depositPercent: "0.5",
        maximumCodAmount: "1000.00",
      },
    };
    const fromJsonb = {
      mode: "DEPOSIT_PLUS_COD",
      version: "marketplace-payment-v1",
      policyId: "policy-1",
      cashRequired: "100.00",
      policyVersion: 4,
      digitalRequired: "100.00",
      policyEvidence: {
        id: "policy-1",
        mode: "DEPOSIT_PLUS_COD",
        version: 4,
        depositAmount: null,
        depositPercent: "0.5",
        maximumCodAmount: "1000.00",
      },
      authoritativeTotal: "200.00",
    };
    expect(marketplacePaymentPlansEqual(fresh, fromJsonb)).toBe(true);
  });

  it("still rejects a material policy-evidence change", () => {
    const left = {
      version: "marketplace-payment-v1",
      mode: "DEPOSIT_PLUS_COD",
      authoritativeTotal: "200.00",
      digitalRequired: "100.00",
      cashRequired: "100.00",
      policyId: "policy-1",
      policyVersion: 4,
      policyEvidence: { maximumCodAmount: "1000.00" },
    };
    const right = { ...left, policyEvidence: { maximumCodAmount: "500.00" } };
    expect(marketplacePaymentPlansEqual(left, right)).toBe(false);
  });
});
