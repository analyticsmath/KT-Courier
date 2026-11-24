import { describe, expect, it } from "vitest";
import { eligibleAt } from "@/lib/retention/privacy-retention.service";

describe("retention policy date eligibility", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");

  it("treats an explicit zero-day policy as immediately eligible", () => {
    expect(eligibleAt({ retentionDays: 0 }, createdAt)).toEqual(createdAt);
  });

  it("calculates eligibility from the resource creation time", () => {
    expect(eligibleAt({ retentionDays: 30 }, createdAt)).toEqual(new Date("2026-01-31T00:00:00.000Z"));
  });

  it.each([null, undefined, "0", -1, 1.5, 36501])("rejects an invalid or missing duration (%s)", (retentionDays) => {
    expect(eligibleAt({ retentionDays }, createdAt)).toBeNull();
  });
});
