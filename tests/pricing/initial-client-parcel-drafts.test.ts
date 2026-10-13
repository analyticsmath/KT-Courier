import { describe, expect, it } from "vitest";
import { INITIAL_CLIENT_PARCEL_DRAFTS } from "@/lib/commercial/initial-client-parcel-drafts";
import { SIZES } from "@/lib/client-platform/contracts";
import { ParcelProfileSchema } from "@/lib/commercial/parcel-profiles";

describe("client-supplied example parcel drafts", () => {
  it("uses canonical admin-editable keys rather than unreachable CLIENT_ prefixed keys", () => {
    expect(INITIAL_CLIENT_PARCEL_DRAFTS.map((draft) => draft.stableKey)).toEqual(SIZES);
  });

  it("preserves illustrative dimensions without making them active operating limits", () => {
    expect(INITIAL_CLIENT_PARCEL_DRAFTS.map((draft) => [
      draft.lengthCm, draft.widthCm, draft.heightCm, draft.maximumWeightKg,
    ])).toEqual([
      [30, 20, 10, 5],
      [50, 40, 30, 15],
      [70, 50, 50, 30],
    ]);

    for (const draft of INITIAL_CLIENT_PARCEL_DRAFTS) {
      const editable = ParcelProfileSchema.parse({
        ...draft,
        status: "DRAFT",
        effectiveFrom: "2026-10-13T00:00:00.000Z",
        effectiveTo: null,
        expectedVersion: 0,
        reason: "Illustrative client dimensions awaiting operational approval.",
      });
      expect(editable.status).toBe("DRAFT");
      expect(editable.stableKey).toBe(draft.stableKey);
    }
  });
});
