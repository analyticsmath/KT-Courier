import { describe, expect, it } from "vitest";
import {
  withdrawalCreationHash,
  payoutAttemptHash,
  payoutCompletionHash,
} from "@/lib/withdrawals/withdrawal-idempotency";

describe("withdrawal idempotency hash", () => {
  it("covers replay and changed-payload conflicts", () => {
    const input1 = {
      ownerType: "STORE",
      ownerId: "store-1",
      walletId: "wallet-1",
      amount: "100.00",
      currency: "ZAR" as const,
      payoutDestinationId: "pd-1",
      policyVersion: 1,
    };

    const hash1 = withdrawalCreationHash(input1);
    const hash2 = withdrawalCreationHash(input1);

    // Replay determinism
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);

    // Changed payload produces a different hash
    const inputModified = { ...input1, amount: "200.00" };
    const hashModified = withdrawalCreationHash(inputModified);
    expect(hashModified).not.toBe(hash1);

    // Payout attempt hash determinism
    const attHash1 = payoutAttemptHash({ withdrawalId: "wd-1", operationId: "op-1", actorUserId: "user-1" });
    const attHash2 = payoutAttemptHash({ withdrawalId: "wd-1", operationId: "op-1", actorUserId: "user-1" });
    expect(attHash1).toBe(attHash2);

    // Payout completion hash determinism
    const compHash1 = payoutCompletionHash({ withdrawalId: "wd-1", attemptId: "att-1", externalReference: "manual-bank:ref-1" });
    const compHash2 = payoutCompletionHash({ withdrawalId: "wd-1", attemptId: "att-1", externalReference: "manual-bank:ref-1" });
    expect(compHash1).toBe(compHash2);
  });
});
