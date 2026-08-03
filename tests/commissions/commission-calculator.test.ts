import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateCommission } from "@/lib/commissions/commission-calculator";

const basis = { subjectType: "COURIER_ORDER" as const, subjectId: "order", subjectPublicReference: "ORD-1", pricingReference: "quote", pricingVersion: "pricing-v1", subtotal: "100.00", tax: "15.00", total: "115.00", currency: "ZAR" as const, authoritativeAt: "2026-01-01T00:00:00.000Z" };
const platformRule = { id: "rule", publicReference: "CR-1", ruleCode: "PLATFORM", priority: 10, allocationType: "PLATFORM_COMMISSION_REVENUE" as const, beneficiaryType: "PLATFORM" as const, calculationMethod: "PERCENTAGE_BPS" as const, rateBasisPoints: 1250, fixedAmount: null, minimumAmount: null, maximumAmount: null, isRequired: true };

describe("commission calculator", () => {
  it("calculates integer BPS with deterministic cent rounding", () => {
    const result = calculateCommission({ basis, basisType: "ORDER_TOTAL", calculationVersion: "commission-v1", rules: [platformRule] });
    expect(result.basisAmount).toBe("115.00"); expect(result.totalAmount).toBe("14.38"); expect(result.components[0]?.amount).toBe("14.38");
  });
  it("applies fixed caps and floors without floating point", () => {
    const result = calculateCommission({ basis, basisType: "ORDER_SUBTOTAL", calculationVersion: "commission-v1", rules: [{ ...platformRule, calculationMethod: "FIXED_AMOUNT", rateBasisPoints: null, fixedAmount: new Prisma.Decimal("4.01"), minimumAmount: new Prisma.Decimal("5.00"), maximumAmount: new Prisma.Decimal("5.50") }] });
    expect(result.totalAmount).toBe("5.00");
  });
  it("fails closed when components exceed their basis", () => {
    expect(() => calculateCommission({ basis, basisType: "ORDER_SUBTOTAL", calculationVersion: "commission-v1", rules: [{ ...platformRule, calculationMethod: "FIXED_AMOUNT", rateBasisPoints: null, fixedAmount: new Prisma.Decimal("101.00") }] })).toThrow(/may not exceed/i);
  });
});
