import { describe, expect, it } from "vitest";
import {
  formatPromoterMoney,
  getPromoterEarningPresentation,
  getPromoterLifecyclePresentation,
  getPromoterQualificationPresentation,
  selectPromoterOperationalState,
} from "@/lib/promoter-presentation";

describe("promoter presentation mappings", () => {
  it("prioritises account restriction ahead of downstream activity", () => {
    expect(selectPromoterOperationalState({
      accountStatus: "SUSPENDED",
      identityStatus: "VERIFIED",
      taxProfileStatus: "READY",
      payoutReadinessStatus: "READY",
      agreementStatus: "ACCEPTED",
      pendingQualificationCount: 4,
      hasRecentReferralActivity: true,
    })).toBe("ACCOUNT_RESTRICTED");
  });

  it("keeps approved distinct from active and compliance-ready states", () => {
    expect(selectPromoterOperationalState({ accountStatus: "APPROVED" })).toBe("APPROVED_NOT_ACTIVE");
    expect(selectPromoterOperationalState({ accountStatus: "ACTIVE", identityStatus: "PENDING", taxProfileStatus: "READY", payoutReadinessStatus: "READY", agreementStatus: "ACCEPTED" })).toBe("COMPLIANCE_ACTION_REQUIRED");
  });

  it("fails safely for an unknown lifecycle state", () => {
    const presentation = getPromoterLifecyclePresentation("UNRECOGNISED_STATE");
    expect(presentation.label).toBe("Programme status unavailable");
    expect(presentation.restricted).toBe(true);
    expect(selectPromoterOperationalState({ accountStatus: "UNRECOGNISED_STATE" })).toBe("SOURCE_UNAVAILABLE");
  });

  it("does not label held and released earnings as the same state", () => {
    expect(getPromoterQualificationPresentation("QUALIFIED_HELD")).toMatchObject({ isHeld: true, label: "Qualified — earning held" });
    expect(getPromoterQualificationPresentation("RELEASED")).toMatchObject({ isHeld: false, label: "Released" });
    expect(getPromoterEarningPresentation("PAYABLE").label).toBe("Available");
  });

  it("formats a server-issued decimal without number coercion", () => {
    expect(formatPromoterMoney("1234567.5")).toBe("ZAR 1,234,567.50");
    expect(formatPromoterMoney("-12.00")).toBe("−ZAR 12.00");
  });
});
