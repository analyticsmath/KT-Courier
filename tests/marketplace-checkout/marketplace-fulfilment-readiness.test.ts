import { describe, expect, it, vi } from "vitest";
import { assertNewMarketplacePaymentPolicyReady } from "@/lib/marketplace-checkout/marketplace-fulfilment-readiness";

describe("live marketplace payment fulfilment precondition", () => {
  it("rejects new payments when the platform has no current approved active fulfilment policy", async () => {
    const find = vi.fn().mockResolvedValue(null);
    await expect(assertNewMarketplacePaymentPolicyReady(find)).rejects.toMatchObject({
      code: "PAYMENT_PREPARATION_BLOCKED",
    });
    expect(find).toHaveBeenCalledTimes(1);
  });
  it("allows a new payment after the policy lookup confirms active status", async () => {
    const find = vi.fn().mockResolvedValue({ id: "approved-policy" });
    await expect(assertNewMarketplacePaymentPolicyReady(find)).resolves.toBeUndefined();
  });
  it("does not trust stale or failing policy lookups", async () => {
    await expect(assertNewMarketplacePaymentPolicyReady(async () => { throw new Error("db offline"); })).rejects.toThrow("db offline");
  });
});
