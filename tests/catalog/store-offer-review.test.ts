import { describe, expect, it } from "vitest";
import {
  storeOfferReviewDescription,
  storeOfferReviewLabel,
} from "@/lib/catalog/store-offer-review";

describe("store offer review projection", () => {
  it("distinguishes independent approval from publication", () => {
    expect(storeOfferReviewLabel("SUBMITTED", "admin-1")).toBe("Approved");
    expect(
      storeOfferReviewDescription("SUBMITTED", "DRAFT", "admin-1"),
    ).toContain("must still publish");
  });

  it("shows pending review, requested changes, and an unsubmitted draft accurately", () => {
    expect(storeOfferReviewLabel("SUBMITTED", null)).toBe("Awaiting KT review");
    expect(storeOfferReviewLabel("NEEDS_CHANGES", null)).toBe("Changes requested");
    expect(storeOfferReviewLabel("DRAFT", null)).toBe("Not submitted");
  });
});
