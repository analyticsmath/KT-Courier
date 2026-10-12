import { describe, expect, it } from "vitest";
import { completedAdjustmentResolution } from "@/lib/store-orders/adjustment-resolution";

describe("completed adjustment resolution", () => {
  it("resolves only when no other obligation remains", () => {
    expect(completedAdjustmentResolution({ pendingStatuses: [], openIssues: 0, openCases: 0 })).toEqual({ financialResolutionStatus: "REFUND_COMPLETED", resolutionStatus: "RESOLVED" });
  });
  it("preserves another reserved refund", () => {
    expect(completedAdjustmentResolution({ pendingStatuses: ["REFUND_PENDING"], openIssues: 0, openCases: 0 })).toEqual({ financialResolutionStatus: "REFUND_RESERVED", resolutionStatus: "REFUND_PENDING" });
  });
  it("preserves an unrelated reconciliation case", () => {
    expect(completedAdjustmentResolution({ pendingStatuses: [], openIssues: 0, openCases: 1 }).resolutionStatus).toBe("RECONCILIATION_REQUIRED");
  });
  it("keeps an unresolved line issue open", () => {
    expect(completedAdjustmentResolution({ pendingStatuses: [], openIssues: 1, openCases: 0 }).resolutionStatus).toBe("ISSUE_OPEN");
  });
});
