import { describe, expect, it, vi } from "vitest";
import { Prisma, SystemSettingType } from "@prisma/client";
import {
  getHighRiskRegionIds,
  isHighRiskCashPolicyEvidence,
  parseHighRiskRegionIds,
  setDeliveryRegionHighRisk,
} from "@/lib/settings/high-risk-region-policy";

describe("high-risk delivery region policy", () => {
  it("parses and deduplicates explicit region IDs only", () => {
    expect(parseHighRiskRegionIds(["jhb", "jhb", "pta"])).toEqual(["jhb", "pta"]);
    expect(parseHighRiskRegionIds([])).toEqual([]);
    expect(parseHighRiskRegionIds(["jhb", null])).toBeNull();
    expect(parseHighRiskRegionIds("jhb")).toBeNull();
  });

  it("defaults to no marked regions when the setting does not exist", async () => {
    const db = { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } } as unknown as Pick<Prisma.TransactionClient, "systemSetting">;
    await expect(getHighRiskRegionIds(db)).resolves.toEqual([]);
  });

  it("marks and unmarks a region in the owner-managed JSON setting", async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ type: SystemSettingType.JSON, value: ["jhb"] }),
        upsert: vi.fn().mockResolvedValue({}),
      },
    } as unknown as Pick<Prisma.TransactionClient, "systemSetting">;
    await setDeliveryRegionHighRisk(db, "pta", true);
    expect(db.systemSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "delivery.high_risk_region_ids" },
      update: { type: SystemSettingType.JSON, value: ["jhb", "pta"] },
    }));
  });

  it("rejects cash evidence when either endpoint intersects a high-risk region", () => {
    expect(isHighRiskCashPolicyEvidence({
      originRegionId: "jhb", destinationRegionId: "safe",
      highRiskRegionIdsAtDecision: ["jhb"],
    })).toBe(true);
    expect(isHighRiskCashPolicyEvidence({
      originRegionId: "safe", destinationRegionId: "pta",
      highRiskRegionIdsAtDecision: ["jhb"],
    })).toBe(false);
    expect(isHighRiskCashPolicyEvidence({
      originRegionId: "jhb", destinationRegionId: "safe",
      highRiskRegionIdsAtDecision: "invalid",
    })).toBe(true);
  });
});
