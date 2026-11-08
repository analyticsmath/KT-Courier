import { describe, expect, it } from "vitest";
import { reconcileLoyaltyPointBalance } from "@/lib/rewards/customer-loyalty-reconciliation";

const empty = {
  availablePoints: 0n, debtPoints: 0n,
  lifetimeEarnedPoints: 0n, lifetimeReversedPoints: 0n,
};

describe("non-monetary customer loyalty account and refund reversals", () => {
  it("adds points earned from a verified completed source", () => {
    expect(reconcileLoyaltyPointBalance({
      balance: empty, previouslyRecognizedPoints: 0n, recomputedRecognizedPoints: 100n,
    })).toMatchObject({
      deltaPoints: 100n, availablePoints: 100n, debtPoints: 0n, lifetimeEarnedPoints: 100n,
    });
  });

  it("reverses settled refunds and leaves a debt when previously spent points are insufficient", () => {
    const adjusted = reconcileLoyaltyPointBalance({
      balance: { availablePoints: 10n, debtPoints: 0n, lifetimeEarnedPoints: 100n, lifetimeReversedPoints: 0n },
      previouslyRecognizedPoints: 100n, recomputedRecognizedPoints: 25n,
    });
    expect(adjusted).toMatchObject({
      deltaPoints: -75n, availablePoints: 0n, debtPoints: 65n,
      lifetimeEarnedPoints: 100n, lifetimeReversedPoints: 75n,
    });
    const newEarning = reconcileLoyaltyPointBalance({
      balance: adjusted, previouslyRecognizedPoints: 0n, recomputedRecognizedPoints: 80n,
    });
    expect(newEarning).toMatchObject({
      deltaPoints: 80n, availablePoints: 15n, debtPoints: 0n,
      lifetimeEarnedPoints: 180n, lifetimeReversedPoints: 75n,
    });
  });

  it("is idempotent for a replayed payment or refund", () => {
    const settled = { availablePoints: 25n, debtPoints: 0n, lifetimeEarnedPoints: 100n, lifetimeReversedPoints: 75n };
    expect(reconcileLoyaltyPointBalance({
      balance: settled, previouslyRecognizedPoints: 25n, recomputedRecognizedPoints: 25n,
    })).toEqual({ ...settled, deltaPoints: 0n });
  });

  it("rejects inconsistent balances and BIGINT overflow instead of negative wallet-like projections", () => {
    expect(() => reconcileLoyaltyPointBalance({
      balance: { ...empty, availablePoints: -1n },
      previouslyRecognizedPoints: 0n, recomputedRecognizedPoints: 1n,
    })).toThrow(/not coherent/i);
    expect(() => reconcileLoyaltyPointBalance({
      balance: { ...empty, availablePoints: 10n, debtPoints: 1n },
      previouslyRecognizedPoints: 0n, recomputedRecognizedPoints: 1n,
    })).toThrow(/not coherent/i);
    expect(() => reconcileLoyaltyPointBalance({
      balance: { ...empty, availablePoints: 9223372036854775807n },
      previouslyRecognizedPoints: 0n, recomputedRecognizedPoints: 1n,
    })).toThrow(/supported database range/i);
  });
});
