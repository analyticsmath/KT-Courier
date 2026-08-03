import { describe, expect, it } from "vitest";
import { decidePayfastItnApplication, normalizePayfastItnStatus } from "@/lib/payments/providers/payfast/payfast-itn-status-policy";

describe("Payfast ITN status precedence", () => {
  it.each([["COMPLETE", "COMPLETE"], ["PENDING", "PENDING"], ["FAILED", "FAILED"], ["CANCELLED", "UNKNOWN"]] as const)("normalizes %s conservatively", (input, expected) => expect(normalizePayfastItnStatus(input)).toBe(expected));
  it("makes COMPLETE authoritative after UNKNOWN", () => expect(decidePayfastItnApplication({ normalizedStatus: "COMPLETE", paymentStatus: "PROCESSING", attemptStatus: "UNKNOWN", successAlreadyLinked: false })).toMatchObject({ action: "SUCCEED", ledgerRequired: true }));
  it("does not downgrade success for stale PENDING", () => expect(decidePayfastItnApplication({ normalizedStatus: "PENDING", paymentStatus: "SUCCEEDED", attemptStatus: "SUCCEEDED", successAlreadyLinked: true })).toMatchObject({ action: "IGNORE_STALE", paymentStatus: "SUCCEEDED" }));
  it("reconciles FAILED after success", () => expect(decidePayfastItnApplication({ normalizedStatus: "FAILED", paymentStatus: "SUCCEEDED", attemptStatus: "SUCCEEDED", successAlreadyLinked: true })).toMatchObject({ action: "RECONCILE", reconciliationReason: "CONFLICTING_PROVIDER_STATUS" }));
  it("recognizes duplicate COMPLETE without another ledger", () => expect(decidePayfastItnApplication({ normalizedStatus: "COMPLETE", paymentStatus: "SUCCEEDED", attemptStatus: "SUCCEEDED", successAlreadyLinked: true })).toMatchObject({ action: "DUPLICATE", ledgerRequired: false }));
  it("keeps unknown status unresolved", () => expect(decidePayfastItnApplication({ normalizedStatus: "UNKNOWN", paymentStatus: "REQUIRES_ACTION", attemptStatus: "REQUIRES_ACTION", successAlreadyLinked: false })).toMatchObject({ action: "RECONCILE", reconciliationReason: "UNRECOGNIZED_PROVIDER_STATUS" }));
});
