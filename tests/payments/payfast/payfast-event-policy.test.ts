import { describe, expect, it } from "vitest";
import { canRetryPayfastEvent, isTerminalPayfastEventState } from "@/lib/payments/providers/payfast/payfast-event-policy";
describe("Payfast event processing policy", () => {
  it("makes applied/duplicate/stale/reconciled/rejected receipts terminal", () => expect(["APPLIED", "DUPLICATE", "IGNORED_STALE", "RECONCILIATION_REQUIRED", "REJECTED"].every(isTerminalPayfastEventState)).toBe(true));
  it("retries only received or temporary receipts", () => { expect(canRetryPayfastEvent("TEMPORARY_FAILURE")).toBe(true); expect(canRetryPayfastEvent("APPLIED")).toBe(false); });
});
