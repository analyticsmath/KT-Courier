import { describe, expect, it } from "vitest";
import { cashOperationErrorMessage } from "@/lib/client-platform/cash-operation-error";

describe("COD remittance connection and receipt recovery", () => {
  it("never represents a lost response as proof that a deposit failed", () => {
    const message = cashOperationErrorMessage(new TypeError("Failed to fetch"));
    expect(message).toContain("could not be confirmed");
    expect(message).toContain("same deposit details");
    expect(message).not.toMatch(/deposit (?:failed|rejected)/i);
  });

  it("preserves actionable validation errors from confirmed server replies", () => {
    expect(cashOperationErrorMessage(new Error("Upload a genuine bank slip.")))
      .toBe("Upload a genuine bank slip.");
  });

  it("gives a safe fallback for malformed thrown values", () => {
    expect(cashOperationErrorMessage(null)).toContain("could not be saved");
    expect(cashOperationErrorMessage(new Error(""))).toContain("could not be saved");
  });
});
