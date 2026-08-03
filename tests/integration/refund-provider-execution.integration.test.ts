import { describe, expect, it } from "vitest";
import { assertRefundAttemptTransition } from "@/lib/refunds/refund-attempt-state-machine";

describe("refund provider execution integration", () => {
  it("enforces state transitions for provider attempt lifecycle", () => {
    expect(() => assertRefundAttemptTransition("RESERVED", "PROCESSING")).not.toThrow();
  });
});
