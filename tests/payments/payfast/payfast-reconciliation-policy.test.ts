import { describe, expect, it } from "vitest";
import { reconciliationPriority, reconciliationSummary } from "@/lib/payments/providers/payfast/payfast-reconciliation-policy";
describe("Payfast reconciliation policy", () => {
  it("prioritizes provider-reference and success conflicts", () => { expect(reconciliationPriority("PROVIDER_REFERENCE_CONFLICT")).toBe("CRITICAL"); expect(reconciliationPriority("CONFLICTING_PROVIDER_STATUS")).toBe("CRITICAL"); });
  it("returns bounded safe summaries", () => expect(reconciliationSummary("UNKNOWN_OUTCOME")).not.toMatch(/signature|passphrase|email/i));
});
