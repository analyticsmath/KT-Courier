import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateLocalityCashRisk, INITIAL_HIGH_RISK_AREAS } from "@/lib/settings/high-risk-area-policy";

describe("canonical COD disposable fixture and high-risk suburb policy", () => {
  it("uses a named, valid pickup and destination locality in the synthetic COD fixture", () => {
    const fixture = readFileSync("tests/integration/cod-canonical-support.ts", "utf8");
    expect(fixture).toMatch(/line2: "Marshalltown"/);
    const point = { city: "Johannesburg", suburb: "Marshalltown", province: "Gauteng" };
    expect(evaluateLocalityCashRisk(point, point, INITIAL_HIGH_RISK_AREAS)).toMatchObject({
      restrictCash: false, reviewRequired: false, matchedAreaIds: [],
    });
  });

  it("preserves fail-closed cash rules for missing or high-risk named suburbs", () => {
    const verified = { city: "Johannesburg", suburb: "Marshalltown", province: "Gauteng" };
    expect(evaluateLocalityCashRisk(
      { city: "Johannesburg", province: "Gauteng" }, verified, INITIAL_HIGH_RISK_AREAS,
    )).toMatchObject({ restrictCash: true, reviewRequired: true });
    expect(evaluateLocalityCashRisk(
      { ...verified, suburb: "Hillbrow" }, verified, INITIAL_HIGH_RISK_AREAS,
    )).toMatchObject({ restrictCash: true, reviewRequired: false });
  });
});
