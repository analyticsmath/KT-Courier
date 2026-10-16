import { describe, expect, it } from "vitest";
import { processSubscriptionDunning, type SubscriptionDunningRepository } from "@/lib/subscriptions/subscription-dunning.service";

describe("Subscription Dunning Policy Integration Tests", () => {
  it("never retries blindly on UNKNOWN provider outcome and routes to RECONCILIATION_REQUIRED", async () => {
    const fakeRepo: SubscriptionDunningRepository = {
      applyDunning: async () => {
        throw new Error("Repository should not be called on UNKNOWN");
      },
    };

    const result = await processSubscriptionDunning(fakeRepo, {
      operationId: "op-dun-1",
      providerOutcome: "UNKNOWN",
    });

    expect(result.outcome).toBe("RECONCILIATION_REQUIRED");
    expect(result.attempts).toBe(0);
    if ("safeReason" in result) {
      expect(result.safeReason).toBe("UNKNOWN_PROVIDER_OUTCOME_NO_BLIND_RETRY");
    }
  });

  it("applies dunning progression on definite FAILED provider outcome", async () => {
    const nextDate = new Date(Date.now() + 86400000);
    const fakeRepo: SubscriptionDunningRepository = {
      applyDunning: async () => ({
        outcome: "RETRY_SCHEDULED",
        attempts: 1,
        nextAttemptAt: nextDate,
      }),
    };

    const result = await processSubscriptionDunning(fakeRepo, {
      operationId: "op-dun-2",
      providerOutcome: "FAILED",
    });

    expect(result.outcome).toBe("RETRY_SCHEDULED");
    expect(result.attempts).toBe(1);
    if ("nextAttemptAt" in result) {
      expect(result.nextAttemptAt).toEqual(nextDate);
    }
  });
});
