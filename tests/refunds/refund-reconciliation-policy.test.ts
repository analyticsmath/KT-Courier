import { describe, expect, it } from "vitest";
import { refundAttemptIsStale, refundRequiresReconciliation } from "@/lib/refunds/refund-reconciliation-policy";

describe("refund reconciliation policy", () => {
  it("detects stale processing attempts", () => expect(refundAttemptIsStale({ status: "PROCESSING", updatedAt: new Date(0), now: new Date(60_000), thresholdMs: 60_000 })).toBe(true));
  it.each([{ refundStatus: "RECONCILIATION_REQUIRED", reserveJournalPresent: true, releaseJournalPresent: false, completionJournalPresent: false }, { refundStatus: "SUCCEEDED", reserveJournalPresent: true, releaseJournalPresent: false, completionJournalPresent: false }, { refundStatus: "CANCELLED", reserveJournalPresent: true, releaseJournalPresent: false, completionJournalPresent: false }])("flags incoherent evidence %#", (input) => expect(refundRequiresReconciliation(input)).toBe(true));
  it("keeps a coherent approved reservation out of reconciliation", () => expect(refundRequiresReconciliation({ refundStatus: "APPROVED", reserveJournalPresent: true, releaseJournalPresent: false, completionJournalPresent: false })).toBe(false));
});
