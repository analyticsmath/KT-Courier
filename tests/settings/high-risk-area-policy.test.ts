import { describe, expect, it, vi } from "vitest";
import { Prisma, SystemSettingType } from "@prisma/client";
import {
  INITIAL_HIGH_RISK_AREAS, parseHighRiskAreas, evaluateLocalityCashRisk,
} from "@/lib/settings/high-risk-area-policy";
import { isHighRiskCashPolicyEvidence } from "@/lib/settings/high-risk-region-policy";
import { validateSettingValue } from "@/lib/validation/admin-settings";
import { resolvePaymentBreakdown } from "@/lib/payments/payment-policy.service";

const loc = (suburb: string, city = "Johannesburg") => ({ city, suburb, province: "Gauteng" });

describe("client-listed high-risk locality controls for cash", () => {
  it("retains the named client zones with per-area admin notes and no guessed polygons", () => {
    expect(INITIAL_HIGH_RISK_AREAS).toHaveLength(42);
    for (const name of ["Hillbrow", "Alexandra", "Jabulani", "Tembisa", "Hammanskraal", "Sunnyside", "Mamelodi East", "Mamelodi West", "Winterveld"]) {
      expect(INITIAL_HIGH_RISK_AREAS.some(area => area.name === name)).toBe(true);
    }
    expect(INITIAL_HIGH_RISK_AREAS.every(area => area.notes === "" && area.active)).toBe(true);
    expect(parseHighRiskAreas(INITIAL_HIGH_RISK_AREAS)).not.toBeNull();
    expect(parseHighRiskAreas([...INITIAL_HIGH_RISK_AREAS, INITIAL_HIGH_RISK_AREAS[0]])).toBeNull();
    expect(parseHighRiskAreas([{ id: "jhb-foo", active: true }])).toBeNull();
    const withNote = INITIAL_HIGH_RISK_AREAS.map(area => area.name === "Hillbrow" ? { ...area, notes: "Require digital only; operations will review street-specific exception." } : area);
    expect(validateSettingValue(SystemSettingType.JSON, withNote, "delivery.high_risk_areas").ok).toBe(true);
    expect(validateSettingValue(SystemSettingType.JSON, { bad: true }, "delivery.high_risk_areas").ok).toBe(false);
  });

  it("exactly matches named Johannesburg and Tshwane neighbourhoods, not whole Gauteng", () => {
    expect(evaluateLocalityCashRisk(loc("Hillbrow"), loc("Rosebank"), INITIAL_HIGH_RISK_AREAS)).toMatchObject({ restrictCash: true, matchedAreaIds: ["jhb-hillbrow"], reviewRequired: false });
    expect(evaluateLocalityCashRisk(loc("Rosebank"), loc("Sunnyside", "Pretoria"), INITIAL_HIGH_RISK_AREAS)).toMatchObject({ restrictCash: true, matchedAreaIds: ["pta-sunnyside"], reviewRequired: false });
    expect(evaluateLocalityCashRisk(loc("Rosebank"), loc("Bryanston"), INITIAL_HIGH_RISK_AREAS)).toMatchObject({ restrictCash: false, matchedAreaIds: [], reviewRequired: false });
    expect(evaluateLocalityCashRisk(loc("Hillbrow", "Pretoria"), loc("Rosebank"), INITIAL_HIGH_RISK_AREAS).restrictCash).toBe(false);
    expect(evaluateLocalityCashRisk(loc("Mamelodi", "Pretoria"), loc("Rosebank"), INITIAL_HIGH_RISK_AREAS)).toMatchObject({ restrictCash: true, reviewRequired: true });
    expect(evaluateLocalityCashRisk(loc("Soshanguve", "Pretoria"), loc("Rosebank"), INITIAL_HIGH_RISK_AREAS).restrictCash).toBe(true);
    expect(evaluateLocalityCashRisk(null, loc("Rosebank"), INITIAL_HIGH_RISK_AREAS).reviewRequired).toBe(true);
    expect(evaluateLocalityCashRisk(loc("Rosebank"), { ...loc("Rosebank"), province: "Limpopo" }, INITIAL_HIGH_RISK_AREAS).restrictCash).toBe(true);
  });

  it("keeps the governed risk evidence cash-restrictive at collection time", () => {
    expect(isHighRiskCashPolicyEvidence({ highRiskAreaIdsAtDecision: ["jhb-hillbrow"], highRiskRegionIdsAtDecision: [] })).toBe(true);
    expect(isHighRiskCashPolicyEvidence({ highRiskAreaReviewRequired: true, highRiskRegionIdsAtDecision: [] })).toBe(true);
    expect(isHighRiskCashPolicyEvidence({ highRiskAreaIdsAtDecision: [], highRiskRegionIdsAtDecision: [], originRegionId: "safe" })).toBe(false);
    expect(isHighRiskCashPolicyEvidence({ policyEvidence: { highRiskAreaIdsAtDecision: ["jhb-hillbrow"], highRiskRegionIdsAtDecision: [] } })).toBe(true);
    expect(isHighRiskCashPolicyEvidence({ policyEvidence: { highRiskAreaReviewRequired: true, highRiskRegionIdsAtDecision: [] } })).toBe(true);
    expect(isHighRiskCashPolicyEvidence({ policyEvidence: { originRegionId: "jhb", destinationRegionId: "pta", highRiskRegionIdsAtDecision: ["pta"] } })).toBe(true);
    expect(isHighRiskCashPolicyEvidence({ highRiskAreaIdsAtDecision: "not-an-array" })).toBe(true);
    expect(isHighRiskCashPolicyEvidence({ highRiskAreaReviewRequired: "false" })).toBe(true);
  });

  it("rejects named high-risk cash before committing a provider split", async () => {
    const db = {
      paymentMethodPolicy: {
        findMany: vi.fn().mockResolvedValue([{
          id: "policy-1", versionNumber: 1, mode: "DEPOSIT_PLUS_COD",
          storeId: "store-1", status: "ACTIVE", effectiveFrom: new Date(0),
          effectiveTo: null, depositPercent: new Prisma.Decimal("0.5"),
          maximumCodAmount: new Prisma.Decimal("1000.00"),
        }]),
      },
      store: { findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE", ownerUser: { status: "ACTIVE", emailVerifiedAt: new Date() } }) },
      systemSetting: {
        findUnique: vi.fn(async (args: { where: { key: string } }) => {
          if (args.where.key === "delivery.high_risk_region_ids") return { type: "JSON", value: [] };
          if (args.where.key === "delivery.high_risk_areas") return { type: "JSON", value: INITIAL_HIGH_RISK_AREAS };
          return null;
        }),
      },
    };
    const input = {
      storeId: "store-1", orderType: "STORE",
      authoritativeTotal: "120.00",
      originLocality: loc("Rosebank"), destinationLocality: loc("Hillbrow"),
    };
    await expect(resolvePaymentBreakdown(input, db as never)).rejects.toMatchObject({ code: "HIGH_RISK_CASH_RESTRICTED" });
    await expect(resolvePaymentBreakdown({
      ...input, originLocality: loc("Rosebank"), destinationLocality: loc("Mamelodi", "Pretoria"),
    }, db as never)).rejects.toMatchObject({ code: "HIGH_RISK_POLICY_UNAVAILABLE" });
    await expect(resolvePaymentBreakdown({
      ...input, destinationLocality: loc("Bryanston"),
    }, db as never)).resolves.toMatchObject({
      cashRequired: "60.00", digitalRequired: "60.00",
      policyEvidence: { highRiskAreaIdsAtDecision: [], highRiskAreaReviewRequired: false },
    });
  });
});
