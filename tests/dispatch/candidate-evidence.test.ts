import { describe, expect, it } from "vitest";
import { rankDispatchCandidates } from "@/lib/dispatch/candidate-ranking";
import { dispatchCandidateEvaluationRequestHash } from "@/lib/services/dispatch-candidate-evidence.service";
import { DispatchCandidateEvaluationSchema } from "@/lib/validation/assignment";

describe("dispatch candidate evidence", () => {
  it("uses a deterministic idempotency hash and rejects changed input at the contract boundary", () => {
    const first = dispatchCandidateEvaluationRequestHash({ courierOrderId: "order-a", requestedDriverProfileId: "driver-a" });
    const replay = dispatchCandidateEvaluationRequestHash({ requestedDriverProfileId: "driver-a", courierOrderId: "order-a" });
    const changed = dispatchCandidateEvaluationRequestHash({ courierOrderId: "order-b", requestedDriverProfileId: "driver-a" });
    expect(replay).toBe(first);
    expect(changed).not.toBe(first);
    expect(DispatchCandidateEvaluationSchema.safeParse({ operationId: "00000000-0000-4000-8000-000000000001" }).success).toBe(true);
    expect(DispatchCandidateEvaluationSchema.safeParse({ operationId: "bad", driverProfileId: "client-input" }).success).toBe(false);
  });

  it("keeps equivalent candidate evidence in deterministic rank order", () => {
    const candidates = [
      { id: "driver-b", driverCode: "B", eligible: true, regionMatch: true, vehicleMatch: true, activeLoad: 0, capacity: 1, availabilityUpdatedAt: null },
      { id: "driver-a", driverCode: "A", eligible: true, regionMatch: true, vehicleMatch: true, activeLoad: 0, capacity: 1, availabilityUpdatedAt: null },
    ];
    expect(rankDispatchCandidates(candidates).map((candidate) => candidate.id)).toEqual(["driver-a", "driver-b"]);
  });
});
