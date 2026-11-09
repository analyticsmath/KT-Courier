import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  event: vi.fn(), referrer: vi.fn(), store: vi.fn(), firstPayment: vi.fn(), verify: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    referralEvent: { findUnique: m.event },
    user: { findFirst: m.referrer },
    store: { findFirst: m.store },
    payment: { findFirst: m.firstPayment },
  },
}));
vi.mock("@/lib/rewards/ordinary-referral-financial-evidence", () => ({
  verifyOrdinaryReferralPaymentEvidence: m.verify,
}));

import { inspectOrdinaryReferralEligibility } from "@/lib/rewards/ordinary-referral-eligibility.service";

const event = () => ({
  id: "event-1", createdAt: new Date("2026-11-08"), source: "ORDINARY_SIGNUP", targetUserId: "customer-2",
  targetType: "CUSTOMER", status: "PENDING",
  targetUser: { id: "customer-2", email: "new@example.test", phone: "0722222222", role: "CUSTOMER", status: "ACTIVE", createdAt: new Date("2026-11-08") },
  referralCode: { isActive: true, ownerType: "CUSTOMER", ownerId: "customer-1", metadata: { program: "ORDINARY_REFERRAL_V1" } },
});

describe("read-only ordinary referral payout eligibility preflight", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.event.mockResolvedValue(event());
    m.referrer.mockResolvedValue({ id: "customer-1", email: "first@example.test", phone: "0711111111" });
    m.firstPayment.mockResolvedValue({ id: "payment-1", status: "SUCCEEDED", succeededAt: new Date("2026-11-09") });
    m.verify.mockReturnValue("VERIFIED_FIRST_PAID_ORDER");
  });

  it("fails closed on invalid event identity or a rewarded/expired/cancelled attribution", async () => {
    expect((await inspectOrdinaryReferralEligibility("")).reason).toBe("INVALID_REFERRAL");
    for (const changed of [
      { status: "REWARDED" }, { status: "CANCELLED" },
      { status: "EXPIRED" }, { source: "PROMOTER" },
      { targetUserId: null }, { referralCode: { ...event().referralCode, isActive: false } },
    ]) {
      m.event.mockResolvedValueOnce({ ...event(), ...changed });
      expect((await inspectOrdinaryReferralEligibility("event-1")).eligible).toBe(false);
    }
    expect(m.firstPayment).not.toHaveBeenCalled();
  });

  it("denies a referrer that has the same phone or email, or one without an active owner", async () => {
    for (const referrer of [
      null, { id: "customer-2", email: "first@example.test", phone: null },
      { id: "customer-1", email: "NEW@EXAMPLE.TEST", phone: null },
      { id: "customer-1", email: "different@example.test", phone: "+27 722 222 222" },
    ]) {
      m.referrer.mockResolvedValueOnce(referrer);
      expect((await inspectOrdinaryReferralEligibility("event-1")).reason).toBe("INELIGIBLE_REFERRER");
    }
    expect(m.firstPayment).not.toHaveBeenCalled();
  });

  it("looks up only the earliest successful customer-owned order and never posts money", async () => {
    const result = await inspectOrdinaryReferralEligibility("event-1");
    expect(result).toEqual({
      eligible: true, reason: "VERIFIED_FIRST_PAID_ORDER",
      referralEventId: "event-1", qualifyingPaymentId: "payment-1",
      evidenceStatus: "VERIFIED_FIRST_PAID_ORDER",
    });
    expect(m.firstPayment).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "customer-2", status: "SUCCEEDED",
        subjectType: { in: ["COURIER_ORDER", "MARKETPLACE_CHECKOUT"] },
      }),
      orderBy: [{ succeededAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    }));
    expect(m.verify).toHaveBeenCalledWith(expect.objectContaining({ id: "payment-1" }), "customer-2");
  });

  it("reports no payment and rejected provider evidence without crediting an entitlement", async () => {
    m.firstPayment.mockResolvedValueOnce(null);
    expect((await inspectOrdinaryReferralEligibility("event-1")).reason).toBe("NO_SUCCESSFUL_PAYMENT");
    m.verify.mockReturnValueOnce("UNVERIFIED_PROVIDER_FUNDING");
    const invalid = await inspectOrdinaryReferralEligibility("event-1");
    expect(invalid).toMatchObject({
      eligible: false, reason: "UNVERIFIED_PROVIDER_FUNDING",
      evidenceStatus: "UNVERIFIED_PROVIDER_FUNDING",
    });
  });

  it("refuses successful payments that predate the original signup attribution", async () => {
    m.firstPayment.mockResolvedValueOnce({
      id: "legacy-success", status: "SUCCEEDED",
      succeededAt: new Date("2026-11-07"),
    });
    const result = await inspectOrdinaryReferralEligibility("event-1");
    expect(result).toMatchObject({
      eligible: false, reason: "PAYMENT_PREDATES_ATTRIBUTION",
      qualifyingPaymentId: "legacy-success",
    });
    expect(m.verify).not.toHaveBeenCalled();
  });

  it("supports active store-owner referrals without treating the store as a customer", async () => {
    m.event.mockResolvedValueOnce({
      ...event(), referralCode: {
        ...event().referralCode, ownerType: "STORE", ownerId: "store-1",
      },
    });
    m.store.mockResolvedValueOnce({
      ownerUser: { id: "store-owner", email: "store@example.test", phone: "0733333333" },
    });
    expect((await inspectOrdinaryReferralEligibility("event-1")).eligible).toBe(true);
    expect(m.store).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "store-1", status: "ACTIVE" }),
    }));
  });
});
