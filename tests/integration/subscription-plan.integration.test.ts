import { describe, expect, it } from "vitest";
import {
  assertPlanTransition,
  assertOfferablePlan,
  immutablePlanStatuses,
} from "@/lib/subscriptions/plan-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";

describe("Subscription Plan Policy Integration Tests", () => {
  it("enforces valid plan lifecycle transitions", () => {
    expect(() => assertPlanTransition("DRAFT", "UNDER_REVIEW")).not.toThrow();
    expect(() => assertPlanTransition("UNDER_REVIEW", "APPROVED")).not.toThrow();
    expect(() => assertPlanTransition("APPROVED", "ACTIVE")).not.toThrow();
    expect(() => assertPlanTransition("ACTIVE", "RETIRED")).not.toThrow();

    // Illegal transitions
    expect(() => assertPlanTransition("DRAFT", "ACTIVE")).toThrowError(SubscriptionError);
    expect(() => assertPlanTransition("RETIRED", "ACTIVE")).toThrowError(SubscriptionError);
  });

  it("enforces offerable plan constraints strictly", () => {
    const now = new Date("2026-10-17T00:00:00Z");

    // Valid active rolling month-to-month plan
    expect(() =>
      assertOfferablePlan({
        status: "ACTIVE",
        currency: "ZAR",
        priceAmount: "199.00",
        contractTermType: "ROLLING_MONTH_TO_MONTH",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        effectiveUntil: null,
        at: now,
      })
    ).not.toThrow();

    // Non-active status
    expect(() =>
      assertOfferablePlan({
        status: "DRAFT",
        currency: "ZAR",
        priceAmount: "199.00",
        contractTermType: "ROLLING_MONTH_TO_MONTH",
        effectiveFrom: null,
        effectiveUntil: null,
        at: now,
      })
    ).toThrowError(/not currently offerable/);

    // Non-ZAR currency
    expect(() =>
      assertOfferablePlan({
        status: "ACTIVE",
        currency: "USD",
        priceAmount: "19.00",
        contractTermType: "ROLLING_MONTH_TO_MONTH",
        effectiveFrom: null,
        effectiveUntil: null,
        at: now,
      })
    ).toThrowError(/not currently offerable/);

    // Fixed-term memberships source-locked
    expect(() =>
      assertOfferablePlan({
        status: "ACTIVE",
        currency: "ZAR",
        priceAmount: "199.00",
        contractTermType: "FIXED_TERM",
        effectiveFrom: null,
        effectiveUntil: null,
        at: now,
      })
    ).toThrowError(/Fixed-term memberships are source-locked/);
  });

  it("marks ACTIVE and RETIRED plans as immutable", () => {
    expect(immutablePlanStatuses.has("ACTIVE")).toBe(true);
    expect(immutablePlanStatuses.has("RETIRED")).toBe(true);
    expect(immutablePlanStatuses.has("DRAFT")).toBe(false);
  });
});
