import { describe, expect, it } from "vitest";
import { evaluateDriverEligibility } from "@/lib/dispatch/eligibility";

const input = { userActive: true, profileActive: true, available: true, regionMatch: true, activeLoad: 0, capacity: 1 };
describe("dispatch eligibility", () => {
  it("accepts an active regional driver below capacity", () => expect(evaluateDriverEligibility(input).eligible).toBe(true));
  it("returns stable reason codes", () => {
    const result = evaluateDriverEligibility({ ...input, available: false, activeLoad: 1 });
    expect(result.reasons).toEqual(["DRIVER_UNAVAILABLE", "DRIVER_CAPACITY_REACHED"]);
  });
});
