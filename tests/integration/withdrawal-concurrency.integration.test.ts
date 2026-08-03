import { describe, expect, it } from "vitest";
import { withdrawalCreationHash } from "@/lib/withdrawals/withdrawal-idempotency";

describe("withdrawal concurrency integration", () => {
  it("generates deterministic idempotency hashes for concurrent requests", () => {
    const input = {
      ownerType: "STORE",
      ownerId: "store_1",
      walletId: "wal_1",
      amount: "100.00",
      currency: "ZAR" as const,
      payoutDestinationId: "pd_1",
      policyVersion: 1,
    };
    const hash1 = withdrawalCreationHash(input);
    const hash2 = withdrawalCreationHash(input);
    expect(hash1).toBe(hash2);
  });
});
