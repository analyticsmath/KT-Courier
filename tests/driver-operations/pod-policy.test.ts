import { describe, expect, it } from "vitest";
import { ProofOfDeliveryMethod } from "@/types/db";
import { requiresEvidenceReference } from "@/lib/driver-operations/pod-policy";

describe("POD policy", () => {
  it("requires an asset reference only for future asset-backed methods", () => {
    expect(requiresEvidenceReference(ProofOfDeliveryMethod.OTP)).toBe(false);
    expect(requiresEvidenceReference(ProofOfDeliveryMethod.PHOTO_FUTURE)).toBe(true);
  });
});
