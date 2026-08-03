// API scaffold: read-only list/detail, no public accrual write route, exact
// reversal reason/operation contract, downstream-release block, and DENY checks.
import { describe, expect, it } from "vitest";
import { CommissionReversalSchema } from "@/lib/validation/commissions";

describe("admin commission API contract", () => {
  it("does not permit replacement amounts in reversal input", () => expect(CommissionReversalSchema.safeParse({ operationId: "operation-1", reasonCode: "VOID", amount: "1.00" }).success).toBe(false));
});
