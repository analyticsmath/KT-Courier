import { describe, expect, it } from "vitest";
import { operationalPolicyBounds } from "@/lib/store-orders/store-order.service";

describe("store-order-operational-policy", () => {
  const valid = { acceptanceWindowSeconds: 900, customerDecisionWindowSeconds: 1800, maximumPrepMinutes: 120, maximumPrepExtensionMinutes: 30, maximumIssueCount: 10, maximumSubstitutionProposalsPerLine: 2 };
  it("accepts bounded SLA values", () => expect(operationalPolicyBounds(valid)).toEqual(valid));
  it("rejects unbounded merchant-authored SLA values", () => expect(() => operationalPolicyBounds({ ...valid, acceptanceWindowSeconds: 86_401 })).toThrow("bounded range"));
});
