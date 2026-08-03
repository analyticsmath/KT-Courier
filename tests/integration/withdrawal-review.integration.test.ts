import { describe, expect, it } from "vitest";
import { assertWithdrawalDualControl } from "@/lib/withdrawals/withdrawal-dual-control";

describe("withdrawal review integration", () => {
  it("enforces dual control rules preventing same-actor maker-checker approval", () => {
    expect(() => assertWithdrawalDualControl({ requestedByUserId: "admin1", approvedByUserId: "admin2", processingUserId: "admin1", requiresDualControl: true })).toThrow();
    expect(() => assertWithdrawalDualControl({ requestedByUserId: "user1", approvedByUserId: "admin1", processingUserId: "admin2", requiresDualControl: true })).not.toThrow();
  });
});
