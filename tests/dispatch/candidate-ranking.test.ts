import { describe, expect, it } from "vitest";
import { rankDispatchCandidates } from "@/lib/dispatch/candidate-ranking";

describe("dispatch candidate ranking", () => {
  it("uses deterministic policy ranking without a proximity signal", () => {
    const candidates = [
      { id: "b", driverCode: "B", eligible: true, regionMatch: true, vehicleMatch: true, activeLoad: 1, capacity: 1, availabilityUpdatedAt: null },
      { id: "a", driverCode: "A", eligible: true, regionMatch: true, vehicleMatch: true, activeLoad: 0, capacity: 1, availabilityUpdatedAt: null },
    ];
    expect(rankDispatchCandidates(candidates).map((candidate) => candidate.id)).toEqual(["a", "b"]);
  });
});
