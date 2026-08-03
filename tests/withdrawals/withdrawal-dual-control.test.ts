import { describe, expect, it } from "vitest";
import { assertWithdrawalDualControl } from "@/lib/withdrawals/withdrawal-dual-control";

describe("withdrawal dual control", () => {
  it("requires processor separation from requester and approver", () => { expect(() => assertWithdrawalDualControl({ requestedByUserId: "owner", approvedByUserId: "approver", processingUserId: "owner", requiresDualControl: true })).toThrow(); expect(() => assertWithdrawalDualControl({ requestedByUserId: "owner", approvedByUserId: "approver", processingUserId: "approver", requiresDualControl: true })).toThrow(); });
  it("permits a separate processor", () => { expect(() => assertWithdrawalDualControl({ requestedByUserId: "owner", approvedByUserId: "approver", processingUserId: "processor", requiresDualControl: true })).not.toThrow(); });
});
